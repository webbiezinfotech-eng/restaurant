import { useState, useEffect } from 'react'
import { settingsAPI } from '../../services/api'
import Spinner from '../../components/ui/Spinner'
import toast from 'react-hot-toast'

export default function Settings() {
  const [settings, setSettings] = useState([])
  const [values, setValues]     = useState({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    settingsAPI.list().then(r => {
      const s = r.data.data
      setSettings(s)
      const v = {}; s.forEach(x => { v[x.setting_key] = x.setting_value || '' })
      setValues(v)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsAPI.update(values)
      toast.success('Settings saved.')
    } catch { toast.error('Failed to save.') }
    finally { setSaving(false) }
  }

  const groups = {}
  settings.forEach(s => { if (!groups[s.setting_group]) groups[s.setting_group] = []; groups[s.setting_group].push(s) })

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <button onClick={handleSave} className="btn-primary btn btn-lg" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>

      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="card p-6 mb-5">
          <h2 className="font-display font-bold text-surface-900 text-lg mb-4 capitalize">{group} Settings</h2>
          <div className="space-y-4">
            {items.map(s => (
              <div key={s.setting_key} className="form-group">
                <label className="label">
                  {s.setting_key === 'guest_house_commission' ? 'Guest House Commission (%)' : s.label}
                </label>
                {s.input_type === 'textarea'
                  ? <textarea className="input" rows={2} value={values[s.setting_key] || ''} onChange={e => setValues(p => ({...p, [s.setting_key]: e.target.value}))} />
                  : <input
                      className="input"
                      type={s.input_type || 'text'}
                      min={s.setting_key === 'guest_house_commission' ? 0 : undefined}
                      max={s.setting_key === 'guest_house_commission' ? 100 : undefined}
                      step={s.setting_key === 'guest_house_commission' ? '0.01' : undefined}
                      value={values[s.setting_key] || ''}
                      onChange={e => setValues(p => ({...p, [s.setting_key]: e.target.value}))}
                    />
                }
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary btn btn-lg" disabled={saving}>{saving ? 'Saving…' : 'Save All Settings'}</button>
      </div>
    </div>
  )
}
