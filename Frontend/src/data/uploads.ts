import type { UploadAsset } from '../types'

export const uploads: UploadAsset[] = [
  {
    id: 'u1',
    fileName: 'payments-api-integration-guide-v3.pdf',
    tag: 'Integration Guide',
    uploadedBy: 'dev@bluepeak.example',
    uploadDate: '2026-04-07T11:00:00Z',
    status: 'Uploaded',
  },
  {
    id: 'u2',
    fileName: 'webhook-signature-validation-guide.pdf',
    tag: 'FAQ',
    uploadedBy: 'treasury-eng@northwind.example',
    uploadDate: '2026-04-06T10:15:00Z',
    status: 'Updated',
  },
  {
    id: 'u3',
    fileName: 'reporting-api-integration-guide.pdf',
    tag: 'Integration Guide',
    uploadedBy: 'architect@sterling.example',
    uploadDate: '2026-04-05T09:30:00Z',
    status: 'Uploaded',
  },
  {
    id: 'u4',
    fileName: 'oauth-setup-troubleshooting.pdf',
    tag: 'Resolution Guide',
    uploadedBy: 'infra@vertex.example',
    uploadDate: '2026-04-03T12:00:00Z',
    status: 'Archived',
  },
  {
    id: 'u5',
    fileName: 'account-validation-integration-guide.pdf',
    tag: 'Integration Guide',
    uploadedBy: 'qa@nimbus.example',
    uploadDate: '2026-04-08T01:10:00Z',
    status: 'Uploaded',
  },
]
