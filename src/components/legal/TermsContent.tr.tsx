'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsContentTr() {
  return (
    <div className="py-10">
      <div className="max-w-3xl mx-auto px-2 sm:px-4">
        <h1 className="text-3xl font-bold text-charcoal mb-3">Şartlar ve Koşullar</h1>
        <p className="text-sage-700 mb-8">Bu siteyi kullanımınızı bu şartlar düzenler.</p>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Hizmetin Kullanımı</h2>
            <p className="text-sage-700 leading-relaxed">
              Siteyi sorumlu şekilde kullanın. Yasaları ihlal etmeyin, özellikleri kötüye kullanmayın veya başkalarına zarar vermeyin. Bu şartları ihlal eden hesaplar askıya alınabilir.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">İçerik ve Mülkiyet</h2>
            <p className="text-sage-700 leading-relaxed">
              Gönderdiğiniz içeriğin mülkiyeti sizde kalır. Yayınlayarak, yöneticilerin ayarlarına göre aile sitesi içinde görüntüleme lisansı vermiş olursunuz.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Gizlilik</h2>
            <p className="text-sage-700 leading-relaxed">
              Kişisel verileri gizlilik uygulamalarımıza göre işleriz. Erişim yetkili aile üyeleri ve yöneticilerle sınırlıdır.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Hesap ve Güvenlik</h2>
            <p className="text-sage-700 leading-relaxed">
              Hesabınızın gizliliğini korumaktan ve hesabınızdaki tüm işlemlerden siz sorumlusunuz. Yetkisiz kullanım durumunu yöneticilere bildirin.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Şartlardaki Değişiklikler</h2>
            <p className="text-sage-700 leading-relaxed">
              Bu şartları zaman zaman güncelleyebiliriz. Siteyi kullanmaya devam etmeniz güncel şartları kabul ettiğiniz anlamına gelir.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-charcoal mb-2">Sorular</h2>
            <p className="text-sage-700 leading-relaxed">
              Bu şartlarla ilgili sorularınız için İletişim sayfasından bize ulaşın.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

