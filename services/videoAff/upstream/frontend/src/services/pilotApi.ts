import { apiRoot, getJson, postJson, putFile } from "./http";
import type {
  CreativeKnowledge,
  CreativeKnowledgeBootstrapResult,
  CreativeKnowledgeList,
  CreativeKnowledgeProposalRequest,
  CreativeKnowledgeStatus,
  WorkspaceNotification,
  WorkspaceNotificationList,
} from "../types/pilotApi";

export const pilotApi = {
  learnFromExampleAd: (file: File) =>
    putFile<{ rules: { knowledge_id: string; text: string; status: string }[] }>(
      `${apiRoot}/products/reference-ad`,
      file,
    ),
  creativeKnowledge: (status?: CreativeKnowledgeStatus, signal?: AbortSignal) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return getJson<CreativeKnowledgeList>(`${apiRoot}/marketing/creative-knowledge${query}`, signal);
  },
  bootstrapCreativeKnowledge: (contributor: string, manifestId = "product_ad") =>
    postJson<CreativeKnowledgeBootstrapResult>(`${apiRoot}/marketing/creative-knowledge/bootstrap`, {
      contributor,
      manifest_id: manifestId,
    }),
  retireCreativeKnowledge: (knowledgeId: string) =>
    postJson<CreativeKnowledge>(
      `${apiRoot}/marketing/creative-knowledge/${encodeURIComponent(knowledgeId)}/retire`,
    ),
  proposeCreativeKnowledge: (body: CreativeKnowledgeProposalRequest) =>
    postJson<CreativeKnowledge>(`${apiRoot}/marketing/creative-knowledge`, body),
  decideCreativeKnowledge: (
    knowledgeId: string,
    decision: "approved" | "rejected",
    reviewer: string,
  ) => postJson<CreativeKnowledge>(
    `${apiRoot}/marketing/creative-knowledge/${encodeURIComponent(knowledgeId)}/decision`,
    { decision, reviewer },
  ),
  markCreativeKnowledgeConflict: (knowledgeId: string) =>
    postJson<CreativeKnowledge>(
      `${apiRoot}/marketing/creative-knowledge/${encodeURIComponent(knowledgeId)}/conflict`,
    ),
  notifications: (unreadOnly = false, signal?: AbortSignal) =>
    getJson<WorkspaceNotificationList>(`${apiRoot}/notifications?unread_only=${unreadOnly}`, signal),
  markNotificationRead: (notificationId: string) =>
    postJson<WorkspaceNotification>(`${apiRoot}/notifications/${encodeURIComponent(notificationId)}/read`),
};
