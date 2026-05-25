import DeviceConnector from './DeviceConnector'
import BasicControls from './BasicControls'
import EffectList from './EffectList'
import { useDeviceStatus } from '../hooks/useDevices'

export default function ControlPanel() {
  useDeviceStatus() // keep listener active for status synchronization

  return (
    <div>
      <DeviceConnector />
      <BasicControls />
      <EffectList />
    </div>
  )
}
