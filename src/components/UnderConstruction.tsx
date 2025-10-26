import { Construction } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface UnderConstructionProps {
  domain?: string;
}

export default function UnderConstruction({ domain }: UnderConstructionProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-0 shadow-2xl">
        <CardContent className="p-12 text-center">
          <div className="w-24 h-24 bg-gradient-to-r from-sage-500 to-sage-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <Construction className="w-12 h-12 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-charcoal mb-4">
            Site Under Construction
          </h1>

          <p className="text-lg text-sage-600 mb-6 leading-relaxed">
            This family site is currently being set up and will be available soon.
          </p>

          {domain && (
            <div className="bg-sage-50 border border-sage-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-sage-700">
                <span className="font-semibold">Domain:</span>{' '}
                <code className="bg-white px-2 py-1 rounded text-sage-800">{domain}</code>
              </p>
            </div>
          )}

          <p className="text-sm text-sage-500">
            If you believe this is an error, please contact the site administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
