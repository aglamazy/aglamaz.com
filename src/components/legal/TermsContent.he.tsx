'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsContentHe() {
  return (
    <div className="py-10">
      <div className="max-w-3xl mx-auto px-2 sm:px-4" dir="rtl">
        <h1 className="text-3xl font-bold text-charcoal mb-3">תנאים והגבלות</h1>
        <p className="text-sage-700 mb-8">מסמך זה מגדיר את תנאי השימוש באתר.</p>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">שימוש בשירות</h2>
            <p className="text-sage-700 leading-relaxed">
              השתמשו באתר באחריות. אין להפר חוקים, לנצל לרעה את המערכת או לפגוע באחרים. אנו רשאים להשעות חשבונות המפרים את התנאים.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">תוכן ובעלות</h2>
            <p className="text-sage-700 leading-relaxed">
              הבעלות על התוכן שאתם מעלים נשארת בידיכם. בפרסום, אתם מעניקים לנו רישיון להציגו במסגרת אתר המשפחה בהתאם להגדרות המנהלים.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">פרטיות</h2>
            <p className="text-sage-700 leading-relaxed">
              אנו מעבדים מידע אישי בהתאם לנוהלי הפרטיות שלנו. הגישה מוגבלת לבני משפחה מורשים ולמנהלים.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">חשבונות ואבטחה</h2>
            <p className="text-sage-700 leading-relaxed">
              אתם אחראים לשמירת סודיות החשבון ולכל פעילות המתבצעת בו. דווחו למנהלים על שימוש בלתי מורשה.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">שינויים בתנאים</h2>
            <p className="text-sage-700 leading-relaxed">
              ייתכן שנעדכן את התנאים מעת לעת. שימוש מתמשך באתר מהווה הסכמה לתנאים המעודכנים.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">שאלות</h2>
            <p className="text-sage-700 leading-relaxed">
              לשאלות בנוגע לתנאים, צרו קשר דרך עמוד "צור קשר".
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

