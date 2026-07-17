export type ListmonkCampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'cancelled';

export interface CreateListmonkCampaignInput {
  listId: number;
  name: string;
  subject: string;
  body: string;
  altBody: string;
  fromEmail?: string;
  templateId?: number;
  tags?: string[];
}

export interface ListmonkCampaign {
  id: number;
}

interface ListmonkConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function getConfig(): ListmonkConfig {
  const baseUrl = process.env.LISTMONK_BASE_URL;
  const username = process.env.LISTMONK_USERNAME;
  const apiToken = process.env.LISTMONK_API_TOKEN;

  if (!baseUrl) {
    throw new Error('LISTMONK_BASE_URL is not configured');
  }
  if (!username) {
    throw new Error('LISTMONK_USERNAME is not configured');
  }
  if (!apiToken) {
    throw new Error('LISTMONK_API_TOKEN is not configured');
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    username,
    apiToken,
  };
}

function buildAuthHeader(username: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`;
}

async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class ListmonkService {
  private getConfig() {
    return getConfig();
  }

  async createCampaign(input: CreateListmonkCampaignInput): Promise<ListmonkCampaign> {
    const config = this.getConfig();
    const response = await fetch(`${config.baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(config.username, config.apiToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        subject: input.subject,
        lists: [input.listId],
        type: 'regular',
        content_type: 'html',
        body: input.body,
        altbody: input.altBody,
        messenger: 'email',
        ...(input.fromEmail ? { from_email: input.fromEmail } : {}),
        ...(input.templateId ? { template_id: input.templateId } : {}),
        ...(input.tags?.length ? { tags: input.tags } : {}),
      }),
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(`[ListmonkService] failed to create campaign: ${response.status} ${JSON.stringify(payload)}`);
    }

    const id = payload?.data?.id;
    if (typeof id !== 'number') {
      throw new Error('[ListmonkService] campaign response missing numeric id');
    }

    return { id };
  }

  async setCampaignStatus(campaignId: number, status: ListmonkCampaignStatus): Promise<void> {
    const config = this.getConfig();
    const response = await fetch(`${config.baseUrl}/api/campaigns/${campaignId}/status`, {
      method: 'PUT',
      headers: {
        Authorization: buildAuthHeader(config.username, config.apiToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(
        `[ListmonkService] failed to update campaign ${campaignId} status to ${status}: ` +
          `${response.status} ${JSON.stringify(payload)}`,
      );
    }
  }
}
