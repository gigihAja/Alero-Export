import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  dest: '/tmp/alero-uploads/'
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Alero Export Backend is running'
  });
});

app.post(
  '/generate-token',
  upload.single('serviceAccount'),
  async (req, res) => {
    const tenantId = req.body.tenantId;
    const uploadedFile = req.file;

    if (!tenantId) {
      return res.status(400).json({
        error: 'tenantId is required'
      });
    }

    if (!uploadedFile) {
      return res.status(400).json({
        error: 'serviceAccount JSON is required'
      });
    }

    try {
      execFile(
        'java',
        [
          '-jar',
          path.join(process.cwd(), 'public-api-auth-helper-1.0.422.jar'),
          '-t',
          tenantId,
          '-p',
          uploadedFile.path
        ],
        async (error, stdout, stderr) => {
          try {
            await fs.unlink(uploadedFile.path);
          } catch {
            // ignore
          }

          if (error) {
            console.error('JAVA ERROR:', error);
            console.error('JAVA STDOUT:', stdout);
            console.error('JAVA STDERR:', stderr);

            return res.status(500).json({
              success: false,
              error: 'Token generator failed',
              details: {
                message: error.message,
                exitCode: error.code,
                stdout: stdout,
                stderr: stderr
              }
            });
          }

          const match = stdout.match(/eyJ[A-Za-z0-9._-]+/);

          if (!match) {
            console.error('TOKEN NOT FOUND');
            console.error('JAVA STDOUT:', stdout);
            console.error('JAVA STDERR:', stderr);

            return res.status(500).json({
              success: false,
              error: 'Access token not found',
              details: {
                stdout: stdout,
                stderr: stderr
              }
            });
          }

          return res.json({
            success: true,
            token: match[0]
          });
        }
      );
    } catch (error) {
      try {
        await fs.unlink(uploadedFile.path);
      } catch {
        // ignore
      }

      res.status(500).json({
        error: error.message
      });
    }
  }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});