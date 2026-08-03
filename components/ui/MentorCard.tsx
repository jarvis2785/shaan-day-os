'use client';

interface MentorCardProps {
  assessment: string;
}

export default function MentorCard({ assessment }: MentorCardProps) {
  return (
    <div className="bg-mentor-surface rounded-card p-4 border-l-2 border-accent">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent text-sm font-semibold tracking-wide">MENTOR&apos;S TAKE</span>
      </div>
      <p className="text-text-body text-sm leading-relaxed">{assessment}</p>
    </div>
  );
}
