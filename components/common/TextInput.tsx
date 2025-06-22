
import React from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ label, id, error, className, wrapperClassName, ...props }) => {
  const baseStyle = "block w-full px-3 py-2 rounded-md shadow-sm bg-dark-input_bg text-dark-fg border border-dark-border focus:outline-none focus:ring-1 focus:ring-dark-accent sm:text-sm";
  const errorStyle = "border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400"; // Keep dark variant for error

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-dark-fg mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`${baseStyle} ${error ? errorStyle : ''} ${className || ''}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
};


interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, id, error, className, wrapperClassName, ...props }) => {
  const baseStyle = "block w-full px-3 py-2 rounded-md shadow-sm bg-dark-input_bg text-dark-fg border border-dark-border focus:outline-none focus:ring-1 focus:ring-dark-accent sm:text-sm";
  const errorStyle = "border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400"; // Keep dark variant for error

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-dark-fg mb-1">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`${baseStyle} ${error ? errorStyle : ''} ${className || ''}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
};