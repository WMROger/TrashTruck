import { Redirect } from 'expo-router';
import React from 'react';

export default function UppercaseCictoRedirect() {
  return <Redirect href={'/cicto' as any} />;
}
