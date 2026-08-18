import { Redirect } from 'expo-router';
import React from 'react';

export default function UppercaseCenroRedirect() {
  return <Redirect href={'/cenro' as any} />;
}
