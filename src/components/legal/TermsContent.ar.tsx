'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsContentAr() {
  return (
    <div className="py-10">
      <div className="max-w-3xl mx-auto px-2 sm:px-4" dir="rtl">
        <h1 className="text-3xl font-bold text-charcoal mb-3">الشروط والأحكام</h1>
        <p className="text-sage-700 mb-8">تحكم هذه الشروط والأحكام استخدامك لهذا الموقع.</p>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">استخدام الخدمة</h2>
            <p className="text-sage-700 leading-relaxed">
              استخدم الموقع بمسؤولية. لا تنتهك القوانين، ولا تسيء استخدام الميزات، ولا تُلحق الضرر بالآخرين. يحق لنا تعليق الحسابات التي تنتهك هذه الشروط.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">المحتوى والملكية</h2>
            <p className="text-sage-700 leading-relaxed">
              تحتفظ بملكية المحتوى الذي تنشره. بالنشر، تمنحنا ترخيصاً لعرضه ضمن الموقع العائلي وفق إعدادات المسؤولين.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">الخصوصية</h2>
            <p className="text-sage-700 leading-relaxed">
              نعالج البيانات الشخصية وفق ممارسات الخصوصية لدينا. يقتصر الوصول على أفراد العائلة المرخّصين والمسؤولين.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">الحسابات والأمان</h2>
            <p className="text-sage-700 leading-relaxed">
              أنت مسؤول عن الحفاظ على سرية حسابك وعن جميع الأنشطة التي تجري عليه. أخطر المسؤولين بأي استخدام غير مصرح به.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">التغييرات في الشروط</h2>
            <p className="text-sage-700 leading-relaxed">
              قد نُحدّث هذه الشروط من وقت لآخر. استمرارك في استخدام الموقع يُعدّ موافقةً على الشروط المحدّثة.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">الأسئلة</h2>
            <p className="text-sage-700 leading-relaxed">
              إذا كان لديك أي سؤال بشأن هذه الشروط، يُرجى التواصل معنا عبر صفحة "تواصل معنا".
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
