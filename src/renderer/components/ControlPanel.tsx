import DeviceConnector from './DeviceConnector'
import BasicControls from './BasicControls'
import EffectList from './EffectList'

export default function ControlPanel() {
  return (
    <div>
      <DeviceConnector />
      <BasicControls />
      <EffectList />
    </div>
  )
}
