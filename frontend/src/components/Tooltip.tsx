import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  className?: string;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  trigger = 'hover',
  className = '',
  delay = 300
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltipHandler = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      setShowTooltip(true);
    }, delay);
  };

  const hideTooltipHandler = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
    setTimeout(() => setIsVisible(false), 150); // Allow for fade out animation
  };

  const handleClick = () => {
    if (trigger === 'click') {
      if (showTooltip) {
        hideTooltipHandler();
      } else {
        showTooltipHandler();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getPositionClasses = () => {
    const baseClasses = 'absolute z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm transition-opacity duration-150';
    
    switch (position) {
      case 'top':
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      default:
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  const getArrowClasses = () => {
    const baseClasses = 'absolute w-2 h-2 bg-gray-900 transform rotate-45';
    
    switch (position) {
      case 'top':
        return `${baseClasses} top-full left-1/2 -translate-x-1/2 -mt-1`;
      case 'bottom':
        return `${baseClasses} -top-1 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseClasses} left-full top-1/2 -translate-y-1/2 -ml-1`;
      case 'right':
        return `${baseClasses} -left-1 top-1/2 -translate-y-1/2`;
      default:
        return `${baseClasses} top-full left-1/2 -translate-x-1/2 -mt-1`;
    }
  };

  const triggerProps = {
    ...(trigger === 'hover' && {
      onMouseEnter: showTooltipHandler,
      onMouseLeave: hideTooltipHandler,
    }),
    ...(trigger === 'focus' && {
      onFocus: showTooltipHandler,
      onBlur: hideTooltipHandler,
    }),
    ...(trigger === 'click' && {
      onClick: handleClick,
    }),
  };

  return (
    <div className={`relative inline-block ${className}`} {...triggerProps}>
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`${getPositionClasses()} ${
            showTooltip ? 'opacity-100' : 'opacity-0'
          }`}
          role="tooltip"
          aria-label={content}
        >
          {content}
          <div className={getArrowClasses()}></div>
        </div>
      )}
    </div>
  );
};
