import { store } from '@/store';
import { randomToken } from '@/auth/passwords';

/**
 * Outbound email.
 *
 * This deployment has no mail provider, and inventing one would mean
 * pretending messages were delivered when they were not. So every message is
 * recorded in the store's outbox, which the administration area displays, and
 * written to the server log. Nothing is silently dropped and nothing claims to
 * have been sent.
 *
 * Connecting a real sender is an implementation of `send` that calls the
 * provider and then records the same message. Callers do not change.
 */
export interface Message {
  to: string;
  subject: string;
  body: string;
}

export const notificationService = {
  /** Whether messages actually leave the building. */
  get canDeliver(): boolean {
    return false;
  },

  async send(message: Message): Promise<void> {
    await store.recordMessage({
      id: randomToken(8),
      to: message.to,
      subject: message.subject,
      body: message.body,
      sentAt: new Date().toISOString(),
    });
    console.info(`[notification] to=${message.to} subject=${JSON.stringify(message.subject)}`);
  },
};

export function verificationEmail(name: string, link: string): Omit<Message, 'to'> {
  return {
    subject: 'Verify your Chigari Almajiri Education Platform account',
    body:
      `Hello ${name},\n\n` +
      `Confirm your email address to finish setting up your account:\n\n${link}\n\n` +
      `If you did not create this account you can ignore this message.\n\n` +
      `Chigari Almajiri Education Platform`,
  };
}

export function approvalEmail(name: string, dataset: string, link: string, expires: string) {
  return {
    subject: 'Dataset Access Request Approved',
    body:
      `Hello ${name},\n\n` +
      `Your request for access to the ${dataset} dataset has been approved.\n\n` +
      `You may access the approved dataset using the secure link provided below.\n\n${link}\n\n` +
      `The link is tied to your account and stops working on ${expires}.\n\n` +
      `Thank you for using the Chigari Almajiri Education Platform.`,
  };
}

/**
 * The reviewer's own notes are deliberately not in here. They are an internal
 * record, written for colleagues, and forwarding them to the person they are
 * about is a different decision from recording them.
 */
export function rejectionEmail(name: string, dataset: string) {
  return {
    subject: 'Dataset Access Request Update',
    body:
      `Hello ${name},\n\n` +
      `Your request for access to the ${dataset} dataset could not be approved at this time.\n\n` +
      `Please review the data access requirements and submit a new request if additional ` +
      `information is available.\n\n` +
      `Chigari Almajiri Education Platform`,
  };
}
