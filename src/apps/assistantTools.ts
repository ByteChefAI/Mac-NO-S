import { useSystemStore } from '../system/store'
import type { AppId } from '../system/types'
import { performVisibleAssistantCommand } from '../system/uiAutomation'

export const DEFAULT_GROQ_MODEL = 'qwen/qwen3-32b'

export const assistantTools = [{
  type: 'function',
  function: {
    name: 'control_os',
    description: 'Carry out desktop tasks through the visible Dock, Finder, TextEdit, or other app interface.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['open_app', 'create_file', 'create_folder', 'read_file', 'list_files'] },
        app: { type: 'string', enum: ['finder', 'safari', 'textedit', 'terminal', 'settings', 'assistant'] },
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['action'],
    },
  },
}] as const

interface ToolArgs {
  action: string
  app?: AppId
  path?: string
  content?: string
}

export async function executeAssistantTool(raw: string) {
  let args: ToolArgs
  try { args = JSON.parse(raw) as ToolArgs } catch { return 'The assistant returned an invalid command.' }
  const os = useSystemStore.getState()
  if (!os.assistantControlEnabled) return 'Desktop control is disabled in Privacy & Security settings.'
  const appIds: AppId[] = ['finder', 'safari', 'textedit', 'terminal', 'settings', 'assistant']
  if (args.action === 'open_app' && (!args.app || !appIds.includes(args.app))) return 'That app is not available.'
  try { return await performVisibleAssistantCommand(args) }
  catch (error) { return error instanceof Error ? error.message : 'The visible desktop action failed.' }
}