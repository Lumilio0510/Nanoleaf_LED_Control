import DeviceSettings from './DeviceSettings'
import LLMSettings from './LLMSettings'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">设置</h2>
      <DeviceSettings />
      <LLMSettings />
    </div>
  )
}
