import React from 'react';
import { User, ShieldCheck, Clock, FileText } from 'lucide-react';
import useAuthStore from '../store/authStore';

const ProfilePage = () => {
  const { user } = useAuthStore();

  if (!user) return <div className="pt-25 text-center">Loading...</div>;

  return (
    <div className="pt-25 min-h-screen">
      <div className="container-custom">

        {/* Header */}
        <div className="flex items-center gap-8 mb-12">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-bg-card to-border flex items-center justify-center border-2 border-primary shadow-[0_0_30px_rgba(0,242,254,0.2)]">
            <User size={48} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm border flex items-center gap-1
                ${user.kycStatus === 'verified' ? 'bg-[#00ffaa]/10 text-[#00ffaa] border-[#00ffaa]/20' :
                  user.kycStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                    'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                <ShieldCheck size={14} /> {user.kycStatus?.charAt(0).toUpperCase() + user.kycStatus?.slice(1).replace('_', ' ')}
              </span>
              <span className="text-text-muted text-sm ml-2">Member since {new Date(user.createdAt).getFullYear()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Details Card */}
          <div className="glass-panel p-8">
            <h2 className="text-xl font-semibold mb-6 border-b border-border pb-4">Personal Information</h2>
            <div className="grid gap-6">
              <div>
                <label className="text-sm text-text-muted block mb-1">Email Address</label>
                <div className="text-base font-medium">{user.email}</div>
              </div>
              <div>
                <label className="text-sm text-text-muted block mb-1">Date of Birth</label>
                <div className="text-base font-medium">
                  {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not Provided'}
                </div>
              </div>
              <div>
                <label className="text-sm text-text-muted block mb-1">National ID</label>
                <div className="text-base font-medium">{user.nationalIdNumber || 'Not Provided'}</div>
              </div>
            </div>
          </div>

          {/* Activity/Status Card */}
          <div className="glass-panel p-8">
            <h2 className="text-xl font-semibold mb-6 border-b border-border pb-4">Verification History</h2>
            <div className="grid gap-4">

              {user.kycStatus === 'not_started' && (
                <div className="text-text-muted text-center py-4">No verification actions taken yet.</div>
              )}

              {user.kycStatus !== 'not_started' && (
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/5 hover:border-primary/30 transition-colors">
                  <Clock size={20} className="text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">KYC Submission</div>
                    <div className="text-xs text-text-muted">{new Date(user.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <span className="text-primary text-sm font-medium">Submitted</span>
                </div>
              )}

              {user.kycStatus === 'verified' && (
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/5 hover:border-primary/30 transition-colors">
                  <ShieldCheck size={20} className="text-[#00ffaa]" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Identity Verified</div>
                    <div className="text-xs text-text-muted">{new Date().toLocaleDateString()}</div>
                  </div>
                  <span className="text-[#00ffaa] text-sm font-medium">Approved</span>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
