import React from 'react';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { CssVarsProvider } from '@mui/joy/styles';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Stack, 
  LinearProgress,
  Chip,
  Alert
} from '@mui/joy';
import theme from '../theme';

const ProgressIndicator = ({ 
  steps = [], 
  currentStep = 0, 
  status = 'loading', // 'loading', 'success', 'error'
  error = null 
}) => {
  const completedSteps = currentStep;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <CssVarsProvider theme={theme}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={3}>
            {/* Progress Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="title-md" sx={{ fontWeight: 600 }}>
                🔄 Processing Pipeline
              </Typography>
              <Chip 
                variant="soft" 
                color={status === 'error' ? 'danger' : status === 'success' ? 'success' : 'primary'}
                size="sm"
              >
                {completedSteps}/{totalSteps} Steps
              </Chip>
            </Stack>

            {/* Progress Bar */}
            <Box>
              <LinearProgress 
                determinate 
                value={progressPercentage}
                color={status === 'error' ? 'danger' : status === 'success' ? 'success' : 'primary'}
                sx={{ height: 8, borderRadius: 'lg' }}
              />
              <Typography level="body-xs" sx={{ mt: 1, color: 'text.secondary' }}>
                {Math.round(progressPercentage)}% Complete
              </Typography>
            </Box>

            {/* Steps List */}
            <Stack spacing={2}>
              {steps.map((step, index) => {
                let stepStatus = 'pending';
                let icon = null;
                let chipColor = 'neutral';
                let chipText = 'Pending';
                
                if (index < currentStep) {
                  stepStatus = 'completed';
                  icon = <CheckCircle size={20} style={{ color: 'var(--joy-palette-success-500)' }} />;
                  chipColor = 'success';
                  chipText = 'Complete';
                } else if (index === currentStep) {
                  if (status === 'error') {
                    stepStatus = 'error';
                    icon = <AlertCircle size={20} style={{ color: 'var(--joy-palette-danger-500)' }} />;
                    chipColor = 'danger';
                    chipText = 'Error';
                  } else {
                    stepStatus = 'active';
                    icon = <Loader2 size={20} className="animate-spin" style={{ color: 'var(--joy-palette-primary-500)' }} />;
                    chipColor = 'primary';
                    chipText = 'Processing';
                  }
                } else {
                  stepStatus = 'pending';
                  icon = <Clock size={20} style={{ color: 'var(--joy-palette-neutral-400)' }} />;
                  chipColor = 'neutral';
                  chipText = 'Pending';
                }
                
                return (
                  <Card 
                    key={index} 
                    variant={stepStatus === 'active' ? 'soft' : 'outlined'}
                    color={stepStatus === 'error' ? 'danger' : stepStatus === 'completed' ? 'success' : stepStatus === 'active' ? 'primary' : 'neutral'}
                  >
                    <CardContent orientation="horizontal" sx={{ alignItems: 'center', gap: 2 }}>
                      <Box sx={{ minWidth: 'fit-content' }}>
                        {icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography 
                          level="title-sm" 
                          sx={{ 
                            fontWeight: 600,
                            color: stepStatus === 'completed' ? 'success.700' : 
                                   stepStatus === 'error' ? 'danger.700' : 
                                   stepStatus === 'active' ? 'primary.700' : 'text.primary'
                          }}
                        >
                          {step.title}
                        </Typography>
                        {step.description && (
                          <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            {step.description}
                          </Typography>
                        )}
                        {step.details && (
                          <Typography level="body-xs" sx={{ 
                            color: stepStatus === 'active' ? 'primary.600' : 'text.tertiary', 
                            mt: 0.5,
                            fontFamily: 'monospace'
                          }}>
                            {step.details}
                          </Typography>
                        )}
                        {index === currentStep && status === 'error' && error && (
                          <Alert color="danger" variant="soft" size="sm" sx={{ mt: 1 }}>
                            <Typography level="body-sm">
                              Error: {error}
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                      <Chip 
                        variant="soft" 
                        color={chipColor} 
                        size="sm"
                      >
                        {chipText}
                      </Chip>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>

            {/* Success Message */}
            {status === 'success' && (
              <Alert color="success" variant="soft">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckCircle size={20} />
                  <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                    All steps completed successfully!
                  </Typography>
                </Stack>
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </CssVarsProvider>
  );
};

export default ProgressIndicator;
