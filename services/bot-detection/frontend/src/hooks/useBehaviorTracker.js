import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to collect behavioral events (mouse, click, scroll)
 */
export const useBehaviorTracker = () => {
    const [isTracking, setIsTracking] = useState(false);
    const [events, setEvents] = useState([]);
    const sessionStartTime = useRef(null);

    const addEvent = useCallback((type, extra = {}) => {
        if (!sessionStartTime.current) return;

        setEvents((prev) => [
            ...prev,
            {
                type,
                timestamp: Date.now(),
                ...extra
            }
        ]);
    }, []);

    useEffect(() => {
        if (!isTracking) return;

        const handleMouseMove = (e) => {
            addEvent('move', { x: e.clientX, y: e.clientY });
        };

        const handleClick = (e) => {
            addEvent('click', { button: e.button === 0 ? 'l' : 'r', x: e.clientX, y: e.clientY });
        };

        const handleScroll = () => {
            addEvent('scroll', { y: window.scrollY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleClick);
        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleClick);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isTracking, addEvent]);

    const startTracking = () => {
        setEvents([]);
        sessionStartTime.current = Date.now();
        setIsTracking(true);
    };

    const stopTracking = () => {
        setIsTracking(false);
        return {
            events,
            metadata: {
                viewport_width: window.innerWidth,
                viewport_height: window.innerHeight,
                user_agent: navigator.userAgent,
                referer: document.referrer || '-'
            }
        };
    };

    return { isTracking, events, startTracking, stopTracking };
};
