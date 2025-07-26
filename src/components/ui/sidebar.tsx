'use client';

import React from 'react';

// Sidebar components - these are stubs for now
export const Sidebar = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <aside className={className}>{children}</aside>
);

export const SidebarContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
);

export const SidebarGroup = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);

export const SidebarGroupContent = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);

export const SidebarGroupLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
);

export const SidebarMenu = ({ children }: { children: React.ReactNode }) => (
  <ul>{children}</ul>
);

export const SidebarMenuButton = ({ 
  children, 
  asChild, 
  className 
}: { 
  children: React.ReactNode; 
  asChild?: boolean; 
  className?: string 
}) => (
  <div className={className}>{children}</div>
);

export const SidebarMenuItem = ({ children }: { children: React.ReactNode }) => (
  <li>{children}</li>
);

export const SidebarHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
);

export const SidebarFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className}>{children}</div>
);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

export const SidebarTrigger = ({ className }: { className?: string }) => (
  <button className={className}>☰</button>
); 