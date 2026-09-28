import { useSystemStore } from '../system/store'
import type { AppId } from '../system/types'
import { performVisibleAssistantCommand, requestAssistantConfirmation } from '../system/uiAutomation'

export const DEFAULT_GROQ_MODEL = 'qwen/qwen3-32b'

export const assistantTools = [{
  type: 'function',
  function: {
    name: 'control_os',
    description: 'Carry out desktop tasks through the visible Dock, Finder, TextEdit, or other app interface. Ask before moving an item to Trash.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['open_app', 'create_file', 'create_folder', 'read_file', 'list_files', 'move_to_trash'] },
        app: { type: 'string', enum: ['finder', 'safari', 'textedit', 'terminal', 'settings', 'assistant', 'trash'] },
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

const inFlight = new Map<string, Promise<string>>()
const recentMutations = new Map<string, { result: string; at: number }>()
let uiActionQueue: Promise<void> = Promise.resolve()

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([first], [second]) => first.localeCompare(second)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export async function executeAssistantTool(raw: string) {
  let args: ToolArgs
  try { args = JSON.parse(raw) as ToolArgs } catch { return 'The assistant returned an invalid command.' }
  const os = useSystemStore.getState()
  if (!os.assistantControlEnabled) return 'Desktop control is disabled in Privacy & Security settings.'
  const appIds: AppId[] = ['finder', 'safari', 'textedit', 'terminal', 'settings', 'assistant', 'trash']
  if (args.action === 'open_app' && (!args.app || !appIds.includes(args.app))) return 'That app is not available.'
  if (args.action === 'move_to_trash' && args.path) {
    const approved = await requestAssistantConfirmation('Move to Trash?', `Mac Assistant wants to move ${args.path} to the Trash.`)
    if (!approved) return 'The user canceled moving this item to the Trash.'
  }
  const key = canonical(args)
  const inProgress = inFlight.get(key)
  if (inProgress) return inProgress
  const mutation = args.action === 'create_file' || args.action === 'create_folder'
  const recent = mutation ? recentMutations.get(key) : undefined
  if (recent && Date.now() - recent.at < 15000) return `I already completed that request: ${recent.result}`

  const action = uiActionQueue.then(async () => {
    try { return await performVisibleAssistantCommand(args) }
    catch (error) { return error instanceof Error ? error.message : 'The visible desktop action failed.' }
  })
  uiActionQueue = action.then(() => undefined, () => undefined)
  inFlight.set(key, action)
  try {
    const result = await action
    if (mutation && !/could not|failed|already exists|not found|not available/i.test(result)) {
      recentMutations.set(key, { result, at: Date.now() })
      if (recentMutations.size > 50) recentMutations.delete(recentMutations.keys().next().value!)
    }
    if (!/could not|failed|already exists|not found|not available|canceled/i.test(result)) useSystemStore.getState().addNotification('Mac Assistant', result)
    return result
  } finally {
    inFlight.delete(key)
  }
}