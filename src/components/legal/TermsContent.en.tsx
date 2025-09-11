'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsContentEn() {
  return (
    <div className="py-10">
      <div className="max-w-3xl mx-auto px-2 sm:px-4">
        <h1 className="text-3xl font-bold text-charcoal mb-3">Terms and Conditions</h1>
        <p className="text-sage-700 mb-8">These Terms and Conditions govern your use of this site.</p>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Use of the Service</h2>
            <p className="text-sage-700 leading-relaxed">
              Use the site responsibly. Do not break laws, abuse features, or harm others. We may suspend accounts that violate these terms.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Content and Ownership</h2>
            <p className="text-sage-700 leading-relaxed">
              You retain ownership of content you submit. By posting, you grant us a license to display it within the family site as configured by admins.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Privacy</h2>
            <p className="text-sage-700 leading-relaxed">
              We process personal data according to our privacy practices. Access is limited to authorized family members and administrators.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Accounts and Security</h2>
            <p className="text-sage-700 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account and for all activity under it. Notify admins of any unauthorized use.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Changes to These Terms</h2>
            <p className="text-sage-700 leading-relaxed">
              We may update these terms from time to time. Continued use constitutes acceptance of the updated terms.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Questions</h2>
            <p className="text-sage-700 leading-relaxed">
              If you have any questions about these terms, please contact us via the Contact page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

