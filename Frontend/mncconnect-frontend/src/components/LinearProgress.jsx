import React from 'react';

const LinearProgress = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] h-1 bg-slate-200">
      <div className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 animate-progress"></div>
    </div>
  );
};

export default LinearProgress;