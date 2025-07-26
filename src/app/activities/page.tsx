'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Heart } from 'lucide-react';

export default function ActivitiesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Heart size={32} className="text-sage-600" />
          <h1 className="text-3xl font-bold text-sage-700">Activities</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Family Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sage-600">
              This is where you can plan and track family activities and events.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 