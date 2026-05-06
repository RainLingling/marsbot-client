import * as React from "react";
import { cn } from "@/lib/utils";

// Custom RadioGroup implementation to avoid Radix UI 1.3.x type incompatibilities.
// Uses native HTML radio inputs with accessible styling.

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  name: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({
  name: "radio-group",
});

interface RadioGroupProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
  name?: string;
  disabled?: boolean;
  required?: boolean;
}

function RadioGroup({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
  name,
  ...props
}: RadioGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;
  const groupName = name ?? React.useId();

  const handleChange = (val: string) => {
    if (!isControlled) setInternalValue(val);
    onValueChange?.(val);
  };

  return (
    <RadioGroupContext.Provider value={{ value: currentValue, onValueChange: handleChange, name: groupName }}>
      <div
        data-slot="radio-group"
        role="radiogroup"
        className={cn("grid gap-3", className)}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

interface RadioGroupItemProps {
  value: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

function RadioGroupItem({
  className,
  value,
  id,
  disabled,
  required,
  ...rest
}: RadioGroupItemProps) {
  const ctx = React.useContext(RadioGroupContext);
  const checked = ctx.value === value;

  return (
    <button
      type="button"
      role="radio"
      id={id}
      aria-checked={checked}
      data-slot="radio-group-item"
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={() => !disabled && ctx.onValueChange?.(value)}
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        className
      )}
      {...rest}
    />
  );
}

export { RadioGroup, RadioGroupItem };
