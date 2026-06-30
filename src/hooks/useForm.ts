import { useState, useCallback } from 'react';

type ValidationRule<T> = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  message?: string;
  validate?: (value: unknown, form: T) => string | null;
};

type ValidationRules<T> = Partial<Record<keyof T, ValidationRule<T>>>;

export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  rules?: ValidationRules<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  }, [errors]);

  const setMultiple = useCallback((partial: Partial<T>) => {
    setValues(prev => ({ ...prev, ...partial }));
  }, []);

  const setTouchedField = useCallback(<K extends keyof T>(key: K) => {
    setTouched(prev => ({ ...prev, [key]: true }));
  }, []);

  const validateField = useCallback(<K extends keyof T>(key: K, value: T[K], allValues: T): string | null => {
    const rule = rules?.[key];
    if (!rule) return null;

    if (rule.required && !value && value !== 0 && value !== false) {
      return rule.message || 'Ce champ est requis';
    }
    if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      return rule.message || `Minimum ${rule.minLength} caractères`;
    }
    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      return rule.message || `Maximum ${rule.maxLength} caractères`;
    }
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return rule.message || 'Format invalide';
    }
    if (rule.validate) return rule.validate(value, allValues);
    return null;
  }, [rules]);

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let valid = true;

    for (const key of Object.keys(values) as Array<keyof T>) {
      const error = validateField(key, values[key], values);
      if (error) {
        newErrors[key] = error;
        valid = false;
      }
    }

    setErrors(newErrors);
    setSubmitted(true);
    return valid;
  }, [values, validateField]);

  const reset = useCallback((newValues?: T) => {
    setValues(newValues || initialValues);
    setErrors({});
    setTouched({});
    setSubmitted(false);
  }, [initialValues]);

  const handleChange = useCallback((key: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValue(key, e.target.value as T[keyof T]);
  }, [setValue]);

  return {
    values,
    errors,
    touched,
    submitted,
    setValue,
    setMultiple,
    setTouchedField,
    validate,
    validateField,
    reset,
    handleChange,
  };
}
