import { ChainType } from "@/chainFactory";
import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Input } from "@/components/ui/input";
import { getModelDisplayWithIcons } from "@/components/ui/model-display";
import { SettingItem } from "@/components/ui/setting-item";
import { DEFAULT_OPEN_AREA, PLUS_UTM_MEDIUMS, SEND_SHORTCUT } from "@/constants";
import { useTab } from "@/contexts/TabContext";
import { cn } from "@/lib/utils";
import { createPlusPageUrl } from "@/plusUtils";
import { getModelKeyFromModel, updateSetting, useSettingsValue } from "@/settings/model";
import { PlusSettings } from "@/settings/v2/components/PlusSettings";
import { checkModelApiKey, formatDateTime } from "@/utils";
import { isSortStrategy } from "@/utils/recentUsageManager";
import { Key, Loader2 } from "lucide-react";
import { Notice } from "obsidian";
import React, { useState } from "react";
import { ApiKeyDialog } from "./ApiKeyDialog";

const ChainType2Label: Record<ChainType, string> = {
  [ChainType.LLM_CHAIN]: "对话",
  [ChainType.VAULT_QA_CHAIN]: "知识库问答（基础）",
  [ChainType.COPILOT_PLUS_CHAIN]: "Copilot Plus",
  [ChainType.PROJECT_CHAIN]: "项目（测试版）",
};

export const BasicSettings: React.FC = () => {
  const settings = useSettingsValue();
  const { setSelectedTab } = useTab();
  const [isChecking, setIsChecking] = useState(false);
  const [conversationNoteName, setConversationNoteName] = useState(
    settings.defaultConversationNoteName || "{$date}_{$time}__{$topic}"
  );

  const applyCustomNoteFormat = () => {
    setIsChecking(true);

    try {
      // Check required variables
      const format = conversationNoteName || "{$date}_{$time}__{$topic}";
      const requiredVars = ["{$date}", "{$time}", "{$topic}"];
      const missingVars = requiredVars.filter((v) => !format.includes(v));

      if (missingVars.length > 0) {
        new Notice(`错误：缺少必需的变量：${missingVars.join(", ")}`, 4000);
        return;
      }

      // Check illegal characters (excluding variable placeholders)
      const illegalChars = /[\\/:*?"<>|]/;
      const formatWithoutVars = format
        .replace(/\{\$date}/g, "")
        .replace(/\{\$time}/g, "")
        .replace(/\{\$topic}/g, "");

      if (illegalChars.test(formatWithoutVars)) {
        new Notice(`错误：格式包含非法字符（\\/:*?"<>|）`, 4000);
        return;
      }

      // Generate example filename
      const { fileName: timestampFileName } = formatDateTime(new Date());
      const firstTenWords = "test topic name";

      // Create example filename
      const customFileName = format
        .replace("{$topic}", firstTenWords.slice(0, 100).replace(/\s+/g, "_"))
        .replace("{$date}", timestampFileName.split("_")[0])
        .replace("{$time}", timestampFileName.split("_")[1]);

      // Save settings
      updateSetting("defaultConversationNoteName", format);
      setConversationNoteName(format);
      new Notice(`格式应用成功！示例：${customFileName}`, 4000);
    } catch (error) {
      new Notice(`应用格式时出错：${error.message}`, 4000);
    } finally {
      setIsChecking(false);
    }
  };

  const defaultModelActivated = !!settings.activeModels.find(
    (m) => m.enabled && getModelKeyFromModel(m) === settings.defaultModelKey
  );
  const enableActivatedModels = settings.activeModels
    .filter((m) => m.enabled)
    .map((model) => ({
      label: getModelDisplayWithIcons(model),
      value: getModelKeyFromModel(model),
    }));

  return (
    <div className="tw-space-y-4">
      <PlusSettings />

      {/* General Section */}
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">通用</div>
        <div className="tw-space-y-4">
          <div className="tw-space-y-4">
            {/* API Key Section */}
            <SettingItem
              type="custom"
              title="API 密钥"
              description={
                <div className="tw-flex tw-items-center tw-gap-1.5">
                  <span className="tw-leading-none">
                    配置不同 AI 服务商的 API 密钥
                  </span>
                  <HelpTooltip
                    content={
                      <div className="tw-flex tw-max-w-96 tw-flex-col tw-gap-2 tw-py-4">
                        <div className="tw-text-sm tw-font-medium tw-text-accent">
                          使用聊天和问答功能需要 API 密钥
                        </div>
                        <div className="tw-text-xs tw-text-muted">
                          要启用聊天和问答功能，请从您选择的服务商提供 API 密钥。
                        </div>
                      </div>
                    }
                  />
                </div>
              }
            >
              <Button
                onClick={() => {
                  new ApiKeyDialog(app, () => setSelectedTab("model")).open();
                }}
                variant="secondary"
                className="tw-flex tw-w-full tw-items-center tw-justify-center tw-gap-2 sm:tw-w-auto sm:tw-justify-start"
              >
                设置密钥
                <Key className="tw-size-4" />
              </Button>
            </SettingItem>
          </div>
          <SettingItem
            type="select"
            title="默认对话模型"
            description={
              <div className="tw-flex tw-items-center tw-gap-1.5">
                <span className="tw-leading-none">选择默认使用的对话模型</span>
                <HelpTooltip
                  content={
                    <div className="tw-flex tw-max-w-96 tw-flex-col tw-gap-2 tw-py-4">
                      <div className="tw-text-sm tw-font-medium tw-text-accent">
                        默认模型是 OpenRouter Gemini 2.5 Flash
                      </div>
                      <div className="tw-text-xs tw-text-muted">
                        在"API密钥"中设置您的 OpenRouter API 密钥以使用此模型，或从其他服务商选择不同的模型。
                      </div>
                    </div>
                  }
                />
              </div>
            }
            value={defaultModelActivated ? settings.defaultModelKey : "选择模型"}
            onChange={(value) => {
              const selectedModel = settings.activeModels.find(
                (m) => m.enabled && getModelKeyFromModel(m) === value
              );
              if (!selectedModel) return;

              const { hasApiKey, errorNotice } = checkModelApiKey(selectedModel, settings);
              if (!hasApiKey && errorNotice) {
                // Keep selection allowed; error will surface in chat on send
              }
              updateSetting("defaultModelKey", value);
            }}
            options={
              defaultModelActivated
                ? enableActivatedModels
                : [{ label: "选择模型", value: "Select Model" }, ...enableActivatedModels]
            }
            placeholder="模型"
          />

          {/* Basic Configuration Group */}
          <SettingItem
            type="select"
            title="默认模式"
            description={
              <div className="tw-flex tw-items-center tw-gap-1.5">
                <span className="tw-leading-none">选择默认的聊天模式</span>
                <HelpTooltip
                  content={
                    <div className="tw-flex tw-max-w-96 tw-flex-col tw-gap-2">
                      <ul className="tw-pl-4 tw-text-sm tw-text-muted">
                        <li>
                          <strong>对话：</strong>通用对话模式，用于日常交流和任务。<i>使用自己的 API 密钥免费。</i>
                        </li>
                        <li>
                          <strong>知识库问答（基础）：</strong>使用语义搜索询问关于您的知识库内容的问题。<i>使用自己的 API 密钥免费。</i>
                        </li>
                        <li>
                          <strong>Copilot Plus：</strong>包含 2 个免费模式的全部功能，以及高级付费功能，包括聊天上下文菜单、高级搜索、AI 智能体等。查看{" "}
                          <a
                            href={createPlusPageUrl(PLUS_UTM_MEDIUMS.MODE_SELECT_TOOLTIP)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tw-text-accent hover:tw-text-accent-hover"
                          >
                            obsidiancopilot.com
                          </a>{" "}
                          了解更多详情。
                        </li>
                      </ul>
                    </div>
                  }
                />
              </div>
            }
            value={settings.defaultChainType}
            onChange={(value) => updateSetting("defaultChainType", value as ChainType)}
            options={Object.entries(ChainType2Label).map(([key, value]) => ({
              label: value,
              value: key,
            }))}
          />

          <SettingItem
            type="select"
            title="插件打开位置"
            description="选择插件的打开位置"
            value={settings.defaultOpenArea}
            onChange={(value) => updateSetting("defaultOpenArea", value as DEFAULT_OPEN_AREA)}
            options={[
              { label: "侧边栏", value: DEFAULT_OPEN_AREA.VIEW },
              { label: "编辑器", value: DEFAULT_OPEN_AREA.EDITOR },
            ]}
          />

          <SettingItem
            type="select"
            title="发送快捷键"
            description={
              <div className="tw-flex tw-items-center tw-gap-1.5">
                <span className="tw-leading-none">选择发送消息的键盘快捷键</span>
                <HelpTooltip
                  content={
                    <div className="tw-flex tw-max-w-96 tw-flex-col tw-gap-2 tw-py-4">
                      <div className="tw-text-sm tw-font-medium tw-text-accent">
                        快捷键不生效？
                      </div>
                      <div className="tw-text-xs tw-text-muted">
                        如果您选择的快捷键不起作用，请检查
                        <strong>Obsidian 设置 → 快捷键</strong>，看看是否有其他命令使用了相同的按键组合。<br />
                        您可能需要先移除或更改冲突的快捷键。
                      </div>
                    </div>
                  }
                />
              </div>
            }
            value={settings.defaultSendShortcut}
            onChange={(value) => updateSetting("defaultSendShortcut", value as SEND_SHORTCUT)}
            options={[
              { label: "Enter（回车）", value: SEND_SHORTCUT.ENTER },
              { label: "Shift + Enter", value: SEND_SHORTCUT.SHIFT_ENTER },
            ]}
          />

          <SettingItem
            type="switch"
            title="自动添加活动内容到上下文"
            description="发送消息时自动将活动笔记或网页标签页（仅桌面版）添加到聊天上下文。"
            checked={settings.autoAddActiveContentToContext}
            onCheckedChange={(checked) => {
              updateSetting("autoAddActiveContentToContext", checked);
            }}
          />

          <SettingItem
            type="switch"
            title="自动添加选中文本到上下文"
            description="自动将笔记或网页浏览器（仅桌面版）中选中的文本添加到聊天上下文。关闭后使用手动命令。"
            checked={settings.autoAddSelectionToContext}
            onCheckedChange={(checked) => {
              updateSetting("autoAddSelectionToContext", checked);
            }}
          />

          <SettingItem
            type="switch"
            title="Markdown 图片"
            description="将 Markdown 中嵌入的图片与文本一起发送给 AI。仅适用于多模态模型。"
            checked={settings.passMarkdownImages}
            onCheckedChange={(checked) => {
              updateSetting("passMarkdownImages", checked);
            }}
          />

          <SettingItem
            type="switch"
            title="建议提示词"
            description="在聊天视图中显示建议的提示词"
            checked={settings.showSuggestedPrompts}
            onCheckedChange={(checked) => updateSetting("showSuggestedPrompts", checked)}
          />

          <SettingItem
            type="switch"
            title="相关笔记"
            description="在聊天视图中显示相关笔记"
            checked={settings.showRelevantNotes}
            onCheckedChange={(checked) => updateSetting("showRelevantNotes", checked)}
          />
        </div>
      </section>

      {/* Saving Conversations Section */}
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">保存对话</div>
        <div className="tw-space-y-4">
          <SettingItem
            type="switch"
            title="自动保存聊天"
            description="在每条用户消息和 AI 回复后自动保存聊天记录。"
            checked={settings.autosaveChat}
            onCheckedChange={(checked) => updateSetting("autosaveChat", checked)}
          />

          <SettingItem
            type="switch"
            title="保存时生成 AI 聊天标题"
            description="启用后，使用 AI 模型为保存的聊天笔记生成简洁的标题。关闭后使用第一条用户消息的前 10 个词作为标题。"
            checked={settings.generateAIChatTitleOnSave}
            onCheckedChange={(checked) => updateSetting("generateAIChatTitleOnSave", checked)}
          />

          <SettingItem
            type="text"
            title="默认对话文件夹名称"
            description="保存聊天对话的默认文件夹名称。默认为"copilot/copilot-conversations""
            value={settings.defaultSaveFolder}
            onChange={(value) => updateSetting("defaultSaveFolder", value)}
            placeholder="copilot/copilot-conversations"
          />

          <SettingItem
            type="text"
            title="默认对话标签"
            description="保存对话时使用的默认标签。默认为"ai-conversations""
            value={settings.defaultConversationTag}
            onChange={(value) => updateSetting("defaultConversationTag", value)}
            placeholder="ai-conversations"
          />

          <SettingItem
            type="custom"
            title="对话文件名模板"
            description={
              <div className="tw-flex tw-items-start tw-gap-1.5 ">
                <span className="tw-leading-none">
                  自定义保存的对话笔记的文件名格式。
                </span>
                <HelpTooltip
                  content={
                    <div className="tw-flex tw-max-w-96 tw-flex-col tw-gap-2 tw-py-4">
                      <div className="tw-text-sm tw-font-medium tw-text-accent">
                        注意：模板中必须包含以下所有变量。
                      </div>
                      <div>
                        <div className="tw-text-sm tw-font-medium tw-text-muted">
                          可用变量：
                        </div>
                        <ul className="tw-pl-4 tw-text-sm tw-text-muted">
                          <li>
                            <strong>{"{$date}"}</strong>：日期，格式为 YYYYMMDD
                          </li>
                          <li>
                            <strong>{"{$time}"}</strong>：时间，格式为 HHMMSS
                          </li>
                          <li>
                            <strong>{"{$topic}"}</strong>：聊天主题
                          </li>
                        </ul>
                        <i className="tw-mt-2 tw-text-sm tw-text-muted">
                          示例：{"{$date}_{$time}__{$topic}"} →
                          20250114_153232__polish_this_article_[[Readme]]
                        </i>
                      </div>
                    </div>
                  }
                />
              </div>
            }
          >
            <div className="tw-flex tw-w-[320px] tw-items-center tw-gap-1.5">
              <Input
                type="text"
                className={cn(
                  "tw-min-w-[80px] tw-grow tw-transition-all tw-duration-200",
                  isChecking ? "tw-w-[80px]" : "tw-w-[120px]"
                )}
                placeholder="{$date}_{$time}__{$topic}"
                value={conversationNoteName}
                onChange={(e) => setConversationNoteName(e.target.value)}
                disabled={isChecking}
              />

              <Button
                onClick={() => applyCustomNoteFormat()}
                disabled={isChecking}
                variant="secondary"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="tw-mr-2 tw-size-4 tw-animate-spin" />
                    应用中
                  </>
                ) : (
                  "应用"
                )}
              </Button>
            </div>
          </SettingItem>
        </div>
      </section>

      {/* Sorting Section */}
      <section>
        <div className="tw-mb-3 tw-text-xl tw-font-bold">排序</div>
        <div className="tw-space-y-4">
          <SettingItem
            type="select"
            title="聊天历史排序策略"
            description="聊天历史列表的排序方式"
            value={settings.chatHistorySortStrategy}
            onChange={(value) => {
              if (isSortStrategy(value)) {
                updateSetting("chatHistorySortStrategy", value);
              }
            }}
            options={[
              { label: "最近访问", value: "recent" },
              { label: "创建时间", value: "created" },
              { label: "字母顺序", value: "name" },
            ]}
          />

          <SettingItem
            type="select"
            title="项目列表排序策略"
            description="项目列表的排序方式"
            value={settings.projectListSortStrategy}
            onChange={(value) => {
              if (isSortStrategy(value)) {
                updateSetting("projectListSortStrategy", value);
              }
            }}
            options={[
              { label: "最近访问", value: "recent" },
              { label: "创建时间", value: "created" },
              { label: "字母顺序", value: "name" },
            ]}
          />
        </div>
      </section>
    </div>
  );
};
