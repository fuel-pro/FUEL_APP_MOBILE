// ============================================================
// LearningPanel - Interactive learning and onboarding
// Inspired by Nextwork.ai - Learn by doing
// ============================================================

import React, { useState, useEffect } from 'react';
import { 
  learningService, 
  LearningModule, 
  LearningStep, 
  UserProgress,
  ACHIEVEMENTS 
} from '../services/LearningService';

interface LearningPanelProps {
  initialModuleId?: string;
  onClose?: () => void;
}

type ViewMode = 'modules' | 'module-detail' | 'step-view' | 'achievements';

export const LearningPanel: React.FC<LearningPanelProps> = ({ 
  initialModuleId,
  onClose 
}) => {
  const [view, setView] = useState<ViewMode>(initialModuleId ? 'module-detail' : 'modules');
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(
    initialModuleId ? learningService.getModule(initialModuleId) || null : null
  );
  const [progress, setProgress] = useState<UserProgress>(learningService.getProgress());
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => {
    setProgress(learningService.getProgress());
  }, []);

  const refreshProgress = () => {
    setProgress(learningService.getProgress());
  };

  // Calculate level and XP
  const level = learningService.getLevel();
  const xpInfo = learningService.getXPToNextLevel();
  const availableModules = learningService.getAvailableModules();

  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      onboarding: 'bg-green-100 text-green-800',
      sales: 'bg-blue-100 text-blue-800',
      inventory: 'bg-yellow-100 text-yellow-800',
      payments: 'bg-purple-100 text-purple-800',
      reports: 'bg-indigo-100 text-indigo-800',
      advanced: 'bg-red-100 text-red-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Get difficulty badge
  const getDifficultyBadge = (difficulty: string) => {
    const styles: Record<string, string> = {
      beginner: 'bg-green-500 text-white',
      intermediate: 'bg-yellow-500 text-white',
      advanced: 'bg-red-500 text-white'
    };
    return styles[difficulty] || 'bg-gray-500 text-white';
  };

  // Start module
  const handleStartModule = (module: LearningModule) => {
    learningService.startModule(module.id);
    setSelectedModule(module);
    setView('module-detail');
    refreshProgress();
  };

  // Complete step
  const handleCompleteStep = (stepId: string) => {
    if (!selectedModule) return;
    learningService.completeStep(selectedModule.id, stepId);
    refreshProgress();
    
    // Move to next step or complete module
    const currentIndex = selectedModule.steps.findIndex(s => s.id === stepId);
    const nextStep = selectedModule.steps[currentIndex + 1];
    
    if (nextStep) {
      setExpandedStep(nextStep.id);
    } else {
      // Module complete
      learningService.completeModule(selectedModule.id);
      refreshProgress();
      setView('modules');
      setSelectedModule(null);
    }
  };

  // Render modules list
  const renderModulesView = () => (
    <div className="space-y-4">
      {/* Progress Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Your Progress</p>
            <p className="text-3xl font-bold">Level {level}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{progress.totalXP} XP</p>
            <p className="text-sm opacity-80">{progress.completedModules.length} modules completed</p>
          </div>
        </div>
        {/* XP Progress Bar */}
        <div className="mt-3 bg-white/20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all"
            style={{ width: `${xpInfo.percentage}%` }}
          />
        </div>
        <p className="text-xs mt-1 opacity-80">{xpInfo.current}/{xpInfo.required} XP to Level {level + 1}</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('achievements')}
          className="flex-1 bg-amber-100 text-amber-800 py-2 px-3 rounded-lg text-sm font-medium hover:bg-amber-200"
        >
          🏆 {progress.achievements.length}/{ACHIEVEMENTS.length} Achievements
        </button>
      </div>

      {/* Module List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Learning Path</h3>
        
        {LEARNING_MODULES.map(module => {
          const moduleProgress = learningService.getModuleProgress(module.id);
          const isAvailable = availableModules.some(m => m.id === module.id);
          const isCompleted = progress.completedModules.includes(module.id);
          
          return (
            <div
              key={module.id}
              className={`border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer ${
                !isAvailable ? 'opacity-50' : ''
              } ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white'}`}
              onClick={() => isAvailable && handleStartModule(module)}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{module.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{module.title}</h4>
                    {isCompleted && <span className="text-green-500">✅</span>}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{module.description}</p>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(module.category)}`}>
                      {module.category}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyBadge(module.difficulty)}`}>
                      {module.difficulty}
                    </span>
                    <span className="text-xs text-gray-500">⏱️ {module.duration}</span>
                    <span className="text-xs text-gray-500">⭐ {module.completionReward} XP</span>
                  </div>
                  
                  {/* Progress Bar */}
                  {moduleProgress.total > 0 && (
                    <div className="mt-2">
                      <div className="bg-gray-200 rounded-full h-1.5">
                        <div 
                          className={`rounded-full h-1.5 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${moduleProgress.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {moduleProgress.completed}/{moduleProgress.total} steps
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render module detail
  const renderModuleDetail = () => {
    if (!selectedModule) return null;
    
    const moduleProgress = learningService.getModuleProgress(selectedModule.id);
    const currentStep = learningService.getCurrentStep(selectedModule.id);
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => { setView('modules'); setSelectedModule(null); }}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
          <span className="text-3xl">{selectedModule.icon}</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{selectedModule.title}</h2>
            <p className="text-sm text-gray-600">{selectedModule.description}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span className="font-medium">{moduleProgress.percentage}%</span>
          </div>
          <div className="bg-blue-200 rounded-full h-3">
            <div 
              className="bg-blue-600 rounded-full h-3 transition-all"
              style={{ width: `${moduleProgress.percentage}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-2">
            {moduleProgress.completed}/{moduleProgress.total} steps completed
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {selectedModule.steps.map((step, index) => {
            const isCompleted = progress.completedSteps[selectedModule.id]?.includes(step.id);
            const isCurrent = currentStep?.id === step.id;
            const isExpanded = expandedStep === step.id || isCurrent;
            
            return (
              <div 
                key={step.id}
                className={`border rounded-xl overflow-hidden ${
                  isCompleted ? 'bg-green-50 border-green-200' : 
                  isCurrent ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : 
                  'bg-white'
                }`}
              >
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full p-4 text-left flex items-center gap-3"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCompleted ? 'bg-green-500 text-white' : 
                    isCurrent ? 'bg-blue-500 text-white' : 
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{step.title}</h4>
                    <p className="text-sm text-gray-500">{step.type === 'action' ? 'Hands-on task' : step.type}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    step.type === 'action' ? 'bg-amber-100 text-amber-800' :
                    step.type === 'quiz' ? 'bg-purple-100 text-purple-800' :
                    step.type === 'tip' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {step.type}
                  </span>
                </button>
                
                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-white">
                    <p className="text-gray-700 mt-3">{step.content}</p>
                    
                    {step.actionHint && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                        <p className="text-sm text-amber-800">
                          <strong>💡 Action:</strong> {step.actionHint}
                        </p>
                      </div>
                    )}
                    
                    {step.type === 'action' && !isCompleted && (
                      <button
                        onClick={() => handleCompleteStep(step.id)}
                        className="w-full mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Mark as Done ✓
                      </button>
                    )}
                    
                    {isCompleted && (
                      <div className="mt-4 bg-green-100 text-green-800 py-2 px-3 rounded-lg text-center font-medium">
                        ✅ Step Completed!
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render achievements
  const renderAchievements = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={() => setView('modules')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <h2 className="text-xl font-bold">🏆 Achievements</h2>
      </div>

      <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-4 text-white">
        <p className="text-sm opacity-80">Earned</p>
        <p className="text-3xl font-bold">{progress.achievements.length}/{ACHIEVEMENTS.length}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {learningService.getAllAchievements().map(achievement => (
          <div 
            key={achievement.id}
            className={`p-4 rounded-xl border text-center ${
              achievement.earned 
                ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' 
                : 'bg-gray-50 border-gray-200 opacity-50'
            }`}
          >
            <div className="text-4xl mb-2">{achievement.icon}</div>
            <h4 className="font-semibold text-sm text-gray-900">{achievement.title}</h4>
            <p className="text-xs text-gray-600 mt-1">{achievement.description}</p>
            {achievement.earned && (
              <p className="text-xs text-green-600 mt-2">⭐ +{achievement.xpReward} XP</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl max-w-2xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <h2 className="text-lg font-bold">FuelPro Academy</h2>
              <p className="text-sm opacity-80">Learn by doing</p>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white text-xl"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {view === 'modules' && renderModulesView()}
        {view === 'module-detail' && renderModuleDetail()}
        {view === 'achievements' && renderAchievements()}
      </div>

      {/* Footer */}
      <div className="border-t p-3 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          Complete modules to earn XP and unlock achievements! ⭐
        </p>
      </div>
    </div>
  );
};

export default LearningPanel;
