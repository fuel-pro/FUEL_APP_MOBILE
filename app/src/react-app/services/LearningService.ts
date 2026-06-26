// ============================================================
// LearningService - Project-based learning system for FuelPro
// Inspired by Nextwork.ai - Learn by doing
// ============================================================

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  category: 'onboarding' | 'sales' | 'inventory' | 'payments' | 'reports' | 'advanced';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string; // e.g., "5 min", "15 min"
  steps: LearningStep[];
  icon: string;
  prerequisites?: string[];
  completionReward?: number; // XP points
}

export interface LearningStep {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'action' | 'quiz' | 'tip';
  actionHint?: string; // What user should do
  elementSelector?: string; // CSS selector for highlighting element
  verificationCheck?: () => boolean; // Function to verify completion
}

export interface UserProgress {
  completedModules: string[];
  completedSteps: Record<string, string[]>; // moduleId -> stepIds
  currentModule: string | null;
  currentStep: string | null;
  totalXP: number;
  streakDays: number;
  lastActivityAt: string | null;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
  xpReward: number;
}

// ─── Learning Content ───
export const LEARNING_MODULES: LearningModule[] = [
  // Onboarding
  {
    id: 'onboarding-basics',
    title: '🚀 Getting Started with FuelPro',
    description: 'Learn the basics of FuelPro and set up your first station',
    category: 'onboarding',
    difficulty: 'beginner',
    duration: '10 min',
    completionReward: 100,
    icon: '🚀',
    steps: [
      {
        id: 'step-1',
        title: 'Welcome to FuelPro',
        content: 'FuelPro is a complete fuel station management solution. Let\'s get you started with the basics.',
        type: 'info'
      },
      {
        id: 'step-2',
        title: 'Create Your First Station',
        content: 'Click on the + button to add your first fuel station. Enter the station name, location, and other details.',
        type: 'action',
        actionHint: 'Look for the + button in the dashboard to add a new station',
        elementSelector: '[data-action="add-station"]'
      },
      {
        id: 'step-3',
        title: 'Set Up Fuel Types',
        content: 'Configure the fuel types you sell (Petrol, Diesel, etc.) and their prices.',
        type: 'action',
        actionHint: 'Go to Station Settings > Fuel Types to configure'
      },
      {
        id: 'step-4',
        title: 'Configure Tax Rates',
        content: 'Set up your tax rate for accurate invoice generation.',
        type: 'action',
        actionHint: 'Find tax settings in your station configuration'
      },
      {
        id: 'step-5',
        title: 'Congratulations!',
        content: 'You\'ve completed the basics! You\'re ready to start managing your fuel station.',
        type: 'info'
      }
    ]
  },
  {
    id: 'onboarding-sales',
    title: '📊 Making Your First Sale',
    description: 'Learn how to record sales and generate invoices',
    category: 'onboarding',
    difficulty: 'beginner',
    duration: '8 min',
    completionReward: 150,
    icon: '📊',
    prerequisites: ['onboarding-basics'],
    steps: [
      {
        id: 'step-1',
        title: 'Understanding Sales Tracking',
        content: 'FuelPro tracks every sale automatically. Let\'s learn how to record a sale.',
        type: 'info'
      },
      {
        id: 'step-2',
        title: 'Select Fuel Type & Amount',
        content: 'Choose the fuel type and enter the liters or amount sold.',
        type: 'action',
        actionHint: 'Use the sales form on your dashboard'
      },
      {
        id: 'step-3',
        title: 'Record Customer Payment',
        content: 'Add customer details if needed and record the payment method.',
        type: 'action'
      },
      {
        id: 'step-4',
        title: 'Generate Invoice',
        content: 'An invoice is automatically generated for every sale.',
        type: 'info'
      }
    ]
  },
  // Sales Module
  {
    id: 'sales-mastery',
    title: '💰 Sales Mastery',
    description: 'Advanced sales tracking, discounts, and customer management',
    category: 'sales',
    difficulty: 'intermediate',
    duration: '20 min',
    completionReward: 300,
    icon: '💰',
    prerequisites: ['onboarding-sales'],
    steps: [
      {
        id: 'step-1',
        title: 'Multiple Payment Methods',
        content: 'Learn to record sales with cash, M-PESA, credit, and mixed payments.',
        type: 'info'
      },
      {
        id: 'step-2',
        title: 'Applying Discounts',
        content: 'Apply percentage or fixed discounts to sales.',
        type: 'action',
        actionHint: 'Use the discount field in the sales form'
      },
      {
        id: 'step-3',
        title: 'Customer Loyalty',
        content: 'Track repeat customers and offer loyalty rewards.',
        type: 'info'
      },
      {
        id: 'step-4',
        title: 'Debt Management',
        content: 'Learn to track and manage customer credit.',
        type: 'info'
      }
    ]
  },
  // Inventory Module
  {
    id: 'inventory-management',
    title: '⛽ Tank Management',
    description: 'Track fuel levels, deliveries, and tank readings',
    category: 'inventory',
    difficulty: 'intermediate',
    duration: '25 min',
    completionReward: 350,
    icon: '⛽',
    steps: [
      {
        id: 'step-1',
        title: 'Recording Tank Readings',
        content: 'Daily tank readings help track fuel levels and detect discrepancies.',
        type: 'info'
      },
      {
        id: 'step-2',
        title: 'Recording Deliveries',
        content: 'Log fuel deliveries with dip readings and invoice details.',
        type: 'action',
        actionHint: 'Use the Delivery Tracker in your station dashboard'
      },
      {
        id: 'step-3',
        title: 'Offloading Procedures',
        content: 'Record fuel offloading with proper documentation.',
        type: 'info'
      },
      {
        id: 'step-4',
        title: 'Stock Alerts',
        content: 'Set up low-stock alerts to never run out of fuel.',
        type: 'action'
      }
    ]
  },
  // M-PESA Payments
  {
    id: 'mpesa-integration',
    title: '📱 M-PESA Integration',
    description: 'Accept mobile money payments seamlessly',
    category: 'payments',
    difficulty: 'intermediate',
    duration: '15 min',
    completionReward: 250,
    icon: '📱',
    steps: [
      {
        id: 'step-1',
        title: 'M-PESA Overview',
        content: 'Learn how to receive M-PESA payments directly in FuelPro.',
        type: 'info'
      },
      {
        id: 'step-2',
        title: 'Transaction Tracking',
        content: 'Auto-reconcile M-PESA payments with your sales.',
        type: 'info'
      },
      {
        id: 'step-3',
        title: 'Payment Links',
        content: 'Send payment links to customers via SMS.',
        type: 'action'
      }
    ]
  },
  // Reports
  {
    id: 'reports-analytics',
    title: '📈 Reports & Analytics',
    description: 'Generate detailed reports and insights',
    category: 'reports',
    difficulty: 'advanced',
    duration: '30 min',
    completionReward: 400,
    icon: '📈',
    prerequisites: ['sales-mastery'],
    steps: [
      {
        id: 'step-1',
        title: 'Daily Sales Report',
        content: 'Generate comprehensive daily sales reports.',
        type: 'info'
      },
      {
        id: 'step-2',
        title: 'Profit Margins',
        content: 'Analyze profit margins by fuel type.',
        type: 'info'
      },
      {
        id: 'step-3',
        title: 'Export Data',
        content: 'Export reports to PDF or Excel.',
        type: 'action'
      },
      {
        id: 'step-4',
        title: 'Scheduled Reports',
        content: 'Set up automated daily/weekly reports.',
        type: 'info'
      }
    ]
  }
];

// ─── Achievements ───
export const ACHIEVEMENTS: Omit<Achievement, 'earnedAt'>[] = [
  {
    id: 'first-sale',
    title: 'First Sale',
    description: 'Recorded your first sale',
    icon: '🎉',
    xpReward: 50
  },
  {
    id: 'week-streak',
    title: 'Week Warrior',
    description: 'Used FuelPro for 7 days in a row',
    icon: '🔥',
    xpReward: 200
  },
  {
    id: 'hundred-sales',
    title: 'Century Club',
    description: 'Recorded 100 sales',
    icon: '💯',
    xpReward: 500
  },
  {
    id: 'first-delivery',
    title: 'Delivery Pro',
    description: 'Recorded your first fuel delivery',
    icon: '🚚',
    xpReward: 100
  },
  {
    id: 'module-complete',
    title: 'Quick Learner',
    description: 'Completed your first learning module',
    icon: '📚',
    xpReward: 150
  },
  {
    id: 'multi-station',
    title: 'Multi-Station Manager',
    description: 'Managing 3 or more stations',
    icon: '🏭',
    xpReward: 300
  }
];

// ─── Service Class ───
class LearningService {
  private readonly STORAGE_KEY = 'fuelpro_learning_progress';
  private readonly XP_PER_LEVEL = 500;
  
  // Get user progress
  getProgress(): UserProgress {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return this.getDefaultProgress();
  }

  // Save progress
  private saveProgress(progress: UserProgress): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
  }

  // Get default progress
  private getDefaultProgress(): UserProgress {
    return {
      completedModules: [],
      completedSteps: {},
      currentModule: null,
      currentStep: null,
      totalXP: 0,
      streakDays: 0,
      lastActivityAt: null,
      achievements: []
    };
  }

  // Get all modules
  getModules(): LearningModule[] {
    return LEARNING_MODULES;
  }

  // Get module by ID
  getModule(id: string): LearningModule | undefined {
    return LEARNING_MODULES.find(m => m.id === id);
  }

  // Get available modules (based on prerequisites)
  getAvailableModules(): LearningModule[] {
    const progress = this.getProgress();
    return LEARNING_MODULES.filter(module => {
      if (!module.prerequisites) return true;
      return module.prerequisites.every(prereq => 
        progress.completedModules.includes(prereq)
      );
    });
  }

  // Start a module
  startModule(moduleId: string): boolean {
    const module = this.getModule(moduleId);
    if (!module) return false;
    
    const progress = this.getProgress();
    if (!progress.completedSteps[moduleId]) {
      progress.completedSteps[moduleId] = [];
    }
    progress.currentModule = moduleId;
    progress.currentStep = module.steps[0]?.id || null;
    this.saveProgress(progress);
    return true;
  }

  // Complete a step
  completeStep(moduleId: string, stepId: string): boolean {
    const progress = this.getProgress();
    
    if (!progress.completedSteps[moduleId]) {
      progress.completedSteps[moduleId] = [];
    }
    
    if (!progress.completedSteps[moduleId].includes(stepId)) {
      progress.completedSteps[moduleId].push(stepId);
      progress.totalXP += 10; // XP for completing a step
      progress.lastActivityAt = new Date().toISOString();
    }
    
    this.saveProgress(progress);
    this.checkAchievements();
    return true;
  }

  // Complete a module
  completeModule(moduleId: string): boolean {
    const module = this.getModule(moduleId);
    if (!module) return false;
    
    const progress = this.getProgress();
    
    if (!progress.completedModules.includes(moduleId)) {
      progress.completedModules.push(moduleId);
      progress.totalXP += module.completionReward || 100;
      progress.currentModule = null;
      progress.currentStep = null;
      progress.lastActivityAt = new Date().toISOString();
    }
    
    this.saveProgress(progress);
    this.checkAchievements();
    return true;
  }

  // Get module progress
  getModuleProgress(moduleId: string): { completed: number; total: number; percentage: number } {
    const module = this.getModule(moduleId);
    if (!module) return { completed: 0, total: 0, percentage: 0 };
    
    const progress = this.getProgress();
    const completed = progress.completedSteps[moduleId]?.length || 0;
    const total = module.steps.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }

  // Get current step in module
  getCurrentStep(moduleId: string): LearningStep | null {
    const module = this.getModule(moduleId);
    const progress = this.getProgress();
    if (!module) return null;
    
    const completedSteps = progress.completedSteps[moduleId] || [];
    
    // Find first incomplete step
    for (const step of module.steps) {
      if (!completedSteps.includes(step.id)) {
        return step;
      }
    }
    
    // All steps complete
    return null;
  }

  // Calculate user level
  getLevel(): number {
    const progress = this.getProgress();
    return Math.floor(progress.totalXP / this.XP_PER_LEVEL) + 1;
  }

  // Get XP to next level
  getXPToNextLevel(): { current: number; required: number; percentage: number } {
    const progress = this.getProgress();
    const level = this.getLevel();
    const currentLevelXP = progress.totalXP % this.XP_PER_LEVEL;
    return {
      current: currentLevelXP,
      required: this.XP_PER_LEVEL,
      percentage: Math.round((currentLevelXP / this.XP_PER_LEVEL) * 100)
    };
  }

  // Check and award achievements
  private checkAchievements(): void {
    const progress = this.getProgress();
    
    // First sale achievement
    if (progress.totalXP >= 50 && !this.hasAchievement('first-sale')) {
      this.awardAchievement('first-sale');
    }
    
    // Module completion achievement
    if (progress.completedModules.length >= 1 && !this.hasAchievement('module-complete')) {
      this.awardAchievement('module-complete');
    }
    
    // Week streak (simplified - just check if used today)
    const today = new Date().toDateString();
    const lastActivity = progress.lastActivityAt;
    if (lastActivity) {
      const lastDate = new Date(lastActivity).toDateString();
      if (today === lastDate) {
        // Update streak
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const lastActivityDate = new Date(lastActivity).toDateString();
        if (lastActivityDate === yesterday) {
          progress.streakDays++;
        } else if (lastActivityDate !== today) {
          progress.streakDays = 1;
        }
        
        if (progress.streakDays >= 7 && !this.hasAchievement('week-streak')) {
          this.awardAchievement('week-streak');
        }
        this.saveProgress(progress);
      }
    }
  }

  // Award achievement
  private awardAchievement(achievementId: string): void {
    const achievementDef = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievementDef) return;
    
    const progress = this.getProgress();
    if (this.hasAchievement(achievementId)) return;
    
    progress.achievements.push({
      ...achievementDef,
      earnedAt: new Date().toISOString()
    });
    progress.totalXP += achievementDef.xpReward;
    this.saveProgress(progress);
  }

  // Check if has achievement
  hasAchievement(achievementId: string): boolean {
    const progress = this.getProgress();
    return progress.achievements.some(a => a.id === achievementId);
  }

  // Get all achievements with status
  getAllAchievements(): (Omit<Achievement, 'earnedAt'> & { earned: boolean; earnedAt?: string })[] {
    const progress = this.getProgress();
    return ACHIEVEMENTS.map(achievement => {
      const earned = progress.achievements.find(a => a.id === achievement.id);
      return {
        ...achievement,
        earned: !!earned,
        earnedAt: earned?.earnedAt
      };
    });
  }

  // Reset progress (for testing)
  resetProgress(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const learningService = new LearningService();

// ─── Make available globally ───
if (typeof window !== 'undefined') {
  (window as any).__learningService__ = learningService;
}

export default learningService;
