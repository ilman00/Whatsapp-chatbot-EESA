export interface SendTextDto {
  to: string;
  message: string;
}

export interface SendTemplateDto {
  to: string;
  templateName: string;
  languageCode?: string;
}

export interface SendImageDto {
  to: string;
  imageUrl: string;
  caption?: string;
}

export interface ButtonDto {
  id: string;
  title: string;
}

export interface SendButtonDto {
  to: string;
  bodyText: string;
  buttons: ButtonDto[];
}

export interface WebhookEntry {
  changes: {
    value: {
      messages?: {
        from: string;
        type: string;
        text?: { body: string };
      }[];
    };
  }[];
}

export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}