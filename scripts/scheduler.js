require('dotenv').config();
const path = require('node:path');
const { spawn } = require('node:child_process');
const cron = require('node-cron');
const { logger, generateExecutionId } = require('./utils/logger');
const { cleanupVideos } = require('./utils/cleanup-videos');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'naukri-automation.js');

function runAutomation() {
	const executionId = generateExecutionId();
	const startTime = Date.now();

	logger.info('Triggering Naukri automation', {
		executionId,
		script: 'naukri-automation.js',
		scheduledTime: new Date().toISOString(),
	});

	// Wrap the automation script in xvfb-run so Chromium gets a virtual display
	// Pass execution ID as environment variable
	const child = spawn('xvfb-run', ['-a', 'node', SCRIPT_PATH], {
		cwd: ROOT_DIR,
		env: {
			...process.env,
			EXECUTION_ID: executionId,
		},
		stdio: 'inherit',
	});

	child.on('close', (code) => {
		const duration = Date.now() - startTime;
		const success = code === 0;

		if (success) {
			logger.info('Automation completed successfully', {
				executionId,
				exitCode: code,
				duration: `${duration}ms`,
			});
		} else {
			logger.error('Automation failed', {
				executionId,
				exitCode: code,
				duration: `${duration}ms`,
			});
		}
	});

	child.on('error', (error) => {
		logger.error('Failed to start automation script', {
			executionId,
			error: error.message,
			stack: error.stack,
		});
	});
}

/**
 * Run weekly video cleanup
 */
async function runVideoCleanup() {
	const executionId = generateExecutionId();

	logger.info('Starting weekly video cleanup', {
		executionId,
		retentionDays: process.env.VIDEO_RETENTION_DAYS || '7',
	});

	try {
		const stats = await cleanupVideos();
		logger.info('Weekly video cleanup completed', {
			executionId,
			stats,
		});
	} catch (error) {
		logger.error('Weekly video cleanup failed', {
			executionId,
			error: error.message,
			stack: error.stack,
		});
	}
}

// Explicit timezone ensures triggers fire in IST even if server uses another tz
const IST = 'Asia/Kolkata';

// Read schedules from environment variables (comma-separated cron expressions)
const automationSchedules = (process.env.AUTOMATION_CRON_SCHEDULES || '0 15 9 * * 1-5')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

const cleanupSchedule = process.env.VIDEO_CLEANUP_CRON || '0 0 2 * * 1';

// Schedule automation runs based on configured cron expressions
for (const schedule of automationSchedules) {
	cron.schedule(schedule, runAutomation, { timezone: IST });
}

// Schedule weekly video cleanup
cron.schedule(cleanupSchedule, runVideoCleanup, { timezone: IST });

logger.info('Scheduler started successfully', {
	automationSchedules,
	cleanupSchedule,
	timezone: IST,
	videoRetentionDays: process.env.VIDEO_RETENTION_DAYS || '7',
	logRetentionDays: process.env.LOG_RETENTION_DAYS || '14',
});
