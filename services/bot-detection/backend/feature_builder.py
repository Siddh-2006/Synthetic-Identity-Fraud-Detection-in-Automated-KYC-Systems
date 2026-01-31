import re
import numpy as np
import pandas as pd
from datetime import datetime

class SequenceParser:
    @staticmethod
    def parse_mouse_behavior(behavior_str, timestamps=None):
        """
        Parses encoded behavior string and aligns with timestamps if provided.
        """
        if not isinstance(behavior_str, str):
            return []
            
        # Find all event tokens: [m(x,y)], [c(l)], etc.
        tokens = re.findall(r'\[[a-z]\([^)]*\)\]', behavior_str)
        events = []
        
        # In this dataset, mousemove_times usually corresponds 1:1 with [m(x,y)] tokens
        # but we need to verify if clicks also have timestamps or if they are intermixed.
        # Observation suggests mousemove_times is an array of times for moves.
        
        move_idx = 0
        for token in tokens:
            event = {'type': None, 'x': None, 'y': None, 't': None}
            
            if token.startswith('[m('):
                match = re.search(r'\((\d+),(\d+)\)', token)
                if match:
                    event.update({'type': 'move', 'x': int(match.group(1)), 'y': int(match.group(2))})
                    if timestamps and move_idx < len(timestamps):
                        event['t'] = timestamps[move_idx]
                        move_idx += 1
                        
            elif token.startswith('[c('):
                match = re.search(r'\((\w)\)', token)
                if match:
                    event['type'] = f"click_{match.group(1)}"
                    # Clicks might not have entries in mousemove_times. 
                    # If we don't have t for clicks, we can interpolate later or use move's t.
            
            if event['type']:
                events.append(event)
                
        return events

class MouseFeatureEngineer:
    def __init__(self):
        self.pause_threshold = 1.0 # 1 second
        
    def compute_features(self, events):
        """
        Computes aggregated features from a list of mouse events.
        Assumes events are sorted by time and include dx, dy, dt.
        """
        if not events or len(events) < 2:
            return {}
            
        df = pd.DataFrame(events)
        if 't' not in df.columns or df['t'].isnull().any():
            # If no timing info, we can only compute geometric features
            return self._compute_geometric_only(df)
            
        # Filter moves for motion stats
        moves = df[df['type'] == 'move'].copy()
        if len(moves) < 2:
            return {}
            
        # Compute step metrics
        moves['dx'] = moves['x'].diff()
        moves['dy'] = moves['y'].diff()
        moves['dt'] = moves['t'].diff()
        
        # Filter invalid dt
        moves = moves[moves['dt'] > 0]
        if len(moves) == 0: return {}
        
        moves['distance'] = np.sqrt(moves['dx']**2 + moves['dy']**2)
        moves['speed'] = moves['distance'] / moves['dt']
        
        # Angles
        moves['angle'] = np.arctan2(moves['dy'], moves['dx'])
        moves['angle_change'] = moves['angle'].diff().abs()
        
        features = {
            'mean_speed': moves['speed'].mean(),
            'std_speed': moves['speed'].std(),
            'max_speed': moves['speed'].max(),
            'median_speed': moves['speed'].median(),
            'speed_p90': moves['speed'].quantile(0.9),
            
            'mean_dt': moves['dt'].mean(),
            'std_dt': moves['dt'].std(),
            'pause_count': (moves['dt'] > self.pause_threshold).sum(),
            'pause_ratio': (moves['dt'] > self.pause_threshold).mean(),
            
            'mean_angle_change': moves['angle_change'].mean(),
            'std_angle_change': moves['angle_change'].std(),
            
            'path_length': moves['distance'].sum(),
        }
        
        # Derived
        total_time = moves['t'].max() - moves['t'].min()
        if total_time > 0:
            features['moves_per_second'] = len(moves) / total_time
            
        # Click stats
        clicks = df[df['type'].str.contains('click')]
        features['total_clicks'] = len(clicks)
        if len(moves) > 0:
            features['click_move_ratio'] = len(clicks) / len(moves)
            
        return features

    def _compute_geometric_only(self, df):
        # Fallback if no timestamps
        moves = df[df['type'] == 'move'].copy()
        if len(moves) < 2: return {}
        
        moves['dx'] = moves['x'].diff()
        moves['dy'] = moves['y'].diff()
        moves['distance'] = np.sqrt(moves['dx']**2 + moves['dy']**2)
        
        return {
            'path_length': moves['distance'].sum(),
            'total_clicks': len(df[df['type'].str.contains('click')]),
            'move_count': len(moves)
        }

class WebLogFeatureEngineer:
    def compute_features(self, entries):
        """
        Aggregates features from web log entries.
        """
        if not entries:
            return {}
            
        df = pd.DataFrame(entries)
        
        # Convert timestamp to datetime
        # Example format: 20/Oct/2023:10:00:01 +0000
        df['datetime'] = pd.to_datetime(df['timestamp'], format='%d/%b/%Y:%H:%M:%S', exact=False)
        df = df.sort_values('datetime')
        
        df['interval'] = df['datetime'].diff().dt.total_seconds()
        
        total_reqs = len(df)
        unique_urls = df['url'].nunique()
        
        features = {
            'total_requests': total_reqs,
            'unique_url_count': unique_urls,
            'repeat_url_ratio': 1 - (unique_urls / total_reqs),
            'std_request_interval': df['interval'].std(),
            
            'html_ratio': df['url'].str.contains(r'\.html|\.php|\/($|\?)').mean(),
            'image_ratio': df['url'].str.contains(r'\.jpg|\.png|\.gif|\.svg').mean(),
            'api_ratio': df['url'].str.contains(r'api\/|store_data').mean(),
            
            'has_referer_ratio': (df['referer'] != '-').mean(),
            'ua_consistency': 1 if df['user_agent'].nunique() == 1 else 0
        }
        
        return features
