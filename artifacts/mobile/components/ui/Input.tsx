import { Ref } from "react";
import { TextInput, TextInputProps } from "react-native";

export interface InputProps extends TextInputProps {
  className?: string;
  ref?: Ref<TextInput>;
}

/** 52 px text field (radius 12) with the accent focus ring. */
export function Input({ className = "", ...rest }: InputProps) {
  return (
    <TextInput
      placeholderTextColorClassName="accent-text-muted"
      className={`h-[52px] px-4 rounded-xl bg-surface border border-border-strong type-body text-text focus:border-2 focus:border-accent ${className}`}
      {...rest}
    />
  );
}
