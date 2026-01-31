import React from 'react';
import { User, ShieldCheck, Clock, FileText } from 'lucide-react';
import useAuthStore from '../store/authStore';

const ProfilePage = () => {
  const { user } = useAuthStore();

  return (
    <div className="pt-25 min-h-screen">
      <div className="container-custom">

        {/* Header */}
        <div className="flex items-center gap-8 mb-12">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-bg-card to-border flex items-center justify-center border-2 border-primary shadow-[0_0_30px_rgba(0,242,254,0.2)]">
            <User size={48} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{user?.name}</h1>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#00ffaa]/10 text-[#00ffaa] rounded-full text-sm border border-[#00ffaa]/20 flex items-center gap-1">
                <ShieldCheck size={14} /> {user?.kycStatus === 'verified' ? 'Verified Identity' : 'Verification Pending'}
              </span>
              <span className="text-text-muted text-sm ml-2">Member since {new Date(user?.createdAt || Date.now()).getFullYear()}</span>
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
                <div className="text-base font-medium">{user?.email}</div>
              </div>
              <div>
                <label className="text-sm text-text-muted block mb-1">Phone Number</label>
                <div className="text-base font-medium">+1 (555) 123-4567</div>
              </div>
              <div>
                <label className="text-sm text-text-muted block mb-1">Nationality</label>
                <div className="text-base font-medium">United States</div>
              </div>
            </div>
          </div>

          {/* Activity/Status Card */}
          <div className="glass-panel p-8">
            <h2 className="text-xl font-semibold mb-6 border-b border-border pb-4">Verification History</h2>
            <div className="grid gap-4">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/5 hover:border-primary/30 transition-colors">
                <Clock size={20} className="text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Full KYC Verification</div>
                  <div className="text-xs text-text-muted">Jan 20, 2024</div>
                </div>
                <span className="text-[#00ffaa] text-sm font-medium">Completed</span>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/5 hover:border-primary/30 transition-colors">
                <FileText size={20} className="text-text-muted" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Document Update</div>
                  <div className="text-xs text-text-muted">Dec 15, 2023</div>
                </div>
                <span className="text-text-muted text-sm font-medium">Archived</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
