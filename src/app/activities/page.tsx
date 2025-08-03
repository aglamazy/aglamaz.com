'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ActivitiesPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Heart size={32} className="text-sage-600" />
          <h1 className="text-3xl font-bold text-sage-700">{t('activitiesTitle')}</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>{t('activitiesFamilyActivitiesTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sage-600">
              {t('activitiesFamilyActivitiesDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 