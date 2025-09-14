import React from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const ProgressIndicator = ({ 
  steps = [], 
  currentStep = 0, 
  status = 'loading', // 'loading', 'success', 'error'
  error = null 
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="space-y-3">
        {steps.map((step, index) => {
          let stepStatus = 'pending';
          let icon = null;
          let textColor = 'text-gray-500';
          
          if (index < currentStep) {
            stepStatus = 'completed';
            icon = <CheckCircle className="w-5 h-5 text-green-500" />;
            textColor = 'text-green-700';
          } else if (index === currentStep) {
            if (status === 'error') {
              stepStatus = 'error';
              icon = <AlertCircle className="w-5 h-5 text-red-500" />;
              textColor = 'text-red-700';
            } else {
              stepStatus = 'active';
              icon = <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
              textColor = 'text-blue-700';
            }
          } else {
            stepStatus = 'pending';
            icon = <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
            textColor = 'text-gray-500';
          }
          
          return (
            <div key={index} className="flex items-center gap-3">
              {icon}
              <div className="flex-1">
                <div className={`font-medium ${textColor}`}>
                  {step.title}
                </div>
                {step.description && (
                  <div className="text-sm text-gray-500 mt-1">
                    {step.description}
                  </div>
                )}
                {index === currentStep && status === 'error' && error && (
                  <div className="text-sm text-red-600 mt-1">
                    Error: {error}
                  </div>
                )}
              </div>
              {stepStatus === 'completed' && (
                <div className="text-xs text-green-600 font-medium">
                  ✓ Complete
                </div>
              )}
              {stepStatus === 'active' && (
                <div className="text-xs text-blue-600 font-medium">
                  Processing...
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {status === 'success' && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">All steps completed successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressIndicator;
