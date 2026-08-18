import { Redirect } from 'expo-router';
import React from 'react';

export default function UppercaseDictRedirect() {
  return <Redirect href={'/dict' as any} />;
}
