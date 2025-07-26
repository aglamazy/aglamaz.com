'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users } from 'lucide-react';

export default function FamilyPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Users size={32} className="text-sage-600" />
          <h1 className="text-3xl font-bold text-sage-700">Family</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Family Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sage-600">
              This is where you can manage your family members and their information.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 