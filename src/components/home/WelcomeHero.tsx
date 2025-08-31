import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import Link from "next/link";
import { createPageUrl } from "../../utils/createPageUrl";
import { BookOpen, Images, Link as LinkIcon, ArrowRight } from "lucide-react";

interface WelcomeHeroProps {
  user: any;
  title?: string;
  subtitle?: string;
}

export default function WelcomeHero({ user, title, subtitle }: WelcomeHeroProps) {
  const quickActions = [
    {
      title: "Read Family Blog",
      description: "Catch up on family news and memories",
      icon: BookOpen,
      url: '/blog/family',
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Browse Photos",
      description: "Explore our photo albums",
      icon: Images,
      url: createPageUrl("Albums"),
      color: "from-purple-500 to-purple-600",
    },
    {
      title: "Family Links",
      description: "Access important family resources",
      icon: LinkIcon,
      url: createPageUrl("Links"),
      color: "from-green-500 to-green-600",
    },
  ];

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
            {title || `Welcome back, ${user?.full_name?.split(' ')[0] || 'Family Member'}!`}
          </h1>
          <p className="text-xl text-sage-600 max-w-2xl mx-auto leading-relaxed">
            {subtitle || 'Stay connected with your family through shared memories, important links, and beautiful photo albums.'}
          </p>
        </motion.div>

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
                      Explore
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
