import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MessageSquare, FileText, Heart, Users, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const quickActions = [
  {
    title: "View Birthdays",
    description: "Check upcoming family birthdays",
    icon: Calendar,
    url: createPageUrl("Birthdays"),
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "Bulletin Board",
    description: "Family announcements and updates",
    icon: MessageSquare,
    url: createPageUrl("BulletinBoard"),
    color: "from-purple-500 to-pink-600",
  },
  {
    title: "Documents",
    description: "Access family documents and photos",
    icon: FileText,
    url: createPageUrl("Documents"),
    color: "from-green-500 to-teal-600",
  },
];

export default function Welcome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="relative inline-block">
            <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              Welcome to the
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Johnson Family Portal
              </span>
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Your central hub for staying connected, sharing memories, and celebrating life's special moments together.
          </p>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {quickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
            >
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm hover:bg-white/90">
                <CardHeader className="pb-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">{action.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-gray-600 mb-4">{action.description}</p>
                  <Link to={action.url}>
                    <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 group-hover:shadow-lg transition-all duration-300">
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Family Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-blue-100"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Family at a Glance</h2>
            <p className="text-gray-600">Stay connected with what matters most</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">5</div>
              <div className="text-gray-600">Family Members</div>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">3</div>
              <div className="text-gray-600">Upcoming Birthdays</div>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">12</div>
              <div className="text-gray-600">Shared Documents</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}