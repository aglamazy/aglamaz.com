import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Camera, MessageCircle } from "lucide-react";

export default function FamilyOverview() {
  const stats = [
    {
      title: "Family Members",
      value: "6",
      description: "Active portal users",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "Photo Albums",
      value: "24",
      description: "Precious memories captured",
      icon: Camera,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      title: "Blog Posts",
      value: "18",
      description: "Stories shared this year",
      icon: MessageCircle,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Events Planned",
      value: "3",
      description: "Upcoming family gatherings",
      icon: Calendar,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
  ];

  const recentActivity = [
    {
      activity: "New photos added to 'Summer Vacation 2024'",
      time: "2 hours ago",
      type: "photos",
    },
    {
      activity: "Mom shared a new family recipe",
      time: "1 day ago",
      type: "blog",
    },
    {
      activity: "Dad updated the family calendar",
      time: "3 days ago",
      type: "event",
    },
  ];

  return (
    <div className="p-8 pt-0">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-charcoal mb-8 text-center">
            Family Overview
          </h2>
          
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + index * 0.1, duration: 0.4 }}
              >
                <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6 text-center">
                    <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div className="text-3xl font-bold text-charcoal mb-2">
                      {stat.value}
                    </div>
                    <div className="font-medium text-charcoal mb-1">
                      {stat.title}
                    </div>
                    <div className="text-sm text-sage-600">
                      {stat.description}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-charcoal">
                Recent Family Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2 + index * 0.1, duration: 0.4 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-sage-50 hover:bg-sage-100 transition-colors duration-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-charcoal mb-1">
                        {item.activity}
                      </p>
                      <p className="text-sm text-sage-600">{item.time}</p>
                    </div>
                    <Badge variant="outline" className="border-sage-200 text-sage-600">
                      {item.type}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}