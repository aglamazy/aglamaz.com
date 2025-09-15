import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import Link from "next/link";
import { BookOpen, Images, ArrowRight, Calendar } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface ActionDef {
  title: string;
  description: string;
  icon: any;
  url: string;
  color: string;
}

interface WelcomeHeroProps {
  user: any;
  title?: string;
  subtitle?: string;
  actions?: ActionDef[];
}

export default function WelcomeHero({ user, title, subtitle, actions }: WelcomeHeroProps) {
  const { t } = useTranslation();
  const defaultActions: ActionDef[] = [
    ...(user
      ? [{
          title: t('familyCalendar') as string,
          description: t('upcomingFamilyGatherings') as string,
          icon: Calendar,
          url: '/calendar',
          color: 'from-amber-500 to-amber-600',
        }]
      : []),
    {
      title: t('readFamilyBlog') as string,
      description: t('catchUpOnFamilyNews') as string,
      icon: BookOpen,
      url: '/blog/family',
      color: "from-blue-500 to-blue-600",
    },
    {
      title: t('browsePhotos') as string,
      description: t('explorePhotoAlbums') as string,
      icon: Images,
      url: '/pictures/feed',
      color: "from-purple-500 to-purple-600",
    },
    // {
    //   title: t('familyLinks') as string,
    //   description: t('accessFamilyResources') as string,
    //   icon: LinkIcon,
    //   url: createPageUrl("Links"),
    //   color: "from-green-500 to-green-600",
    // },
  ];
  const quickActions = Array.isArray(actions) ? actions : defaultActions;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold text-charcoal mb-4">
            {title || (t('welcomeBack', { name: user?.full_name?.split(' ')[0] || t('familyMember') }) as string)}
          </h1>
          <p className="text-xl text-sage-600 max-w-2xl mx-auto leading-relaxed">
            {subtitle || (t('stayConnected') as string)}
          </p>
        </motion.div>

        {quickActions.length > 0 && (
          <div className="grid md:grid-cols-3 gap-8">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2, duration: 0.6 }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <div className={`w-16 h-16 bg-gradient-to-r ${action.color} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                    <action.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-charcoal mb-3">
                    {action.title}
                  </h3>
                  <p className="text-sage-600 mb-6 leading-relaxed">
                    {action.description}
                  </p>
                  <Link href={action.url}>
                    <Button 
                      className="border-sage-200 hover:border-sage-300 hover:bg-sage-50 group"
                    >
                      {t('explore')}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
