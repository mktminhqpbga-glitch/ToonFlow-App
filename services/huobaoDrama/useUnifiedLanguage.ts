import { createApp, h } from 'vue'
import { toast } from 'vue-sonner'
import { i18n, setUiLocale, UI_LOCALES, type UiLocale } from '~/composables/i18n'
import { settingsAPI } from '~/composables/useApi'
import { toastError } from '~/composables/useToast'
import LanguageSwitchDialog from '~/components/LanguageSwitchDialog.vue'

const languageNames = { vi: 'langNameVi', zh: 'langNameZh', en: 'langNameEn', ja: 'langNameJa', ko: 'langNameKo' }
let switching = false

function confirmDialog(language: UiLocale): Promise<boolean> {
  return new Promise(resolve => {
    const t = i18n.global.t
    const host = document.createElement('div')
    document.body.append(host)
    const nameKey = `settings.general.${languageNames[language]}`
    const translatedName = t(nameKey)
    const name = translatedName === nameKey ? UI_LOCALES.find(item => item.value === language)?.label ?? language : translatedName
    const title = t('components.langSwitch.title', { lang: name })
    const app = createApp({
      setup: () => () => h(LanguageSwitchDialog, {
        open: true, title, message: t('components.langSwitch.message'),
        onConfirm: () => finish(true), onCancel: () => finish(false),
      }),
    })
    function finish(accepted: boolean) {
      app.unmount()
      host.remove()
      resolve(accepted)
    }
    app.use(i18n as unknown as Parameters<typeof app.use>[0])
    app.mount(host)
  })
}

export async function confirmUnifiedLanguage(language: UiLocale) {
  if (switching) return
  switching = true
  try {
    if (!await confirmDialog(language)) return
    await settingsAPI.setContentLanguage(language)
    setUiLocale(language)
    toast.info(i18n.global.t('components.langSwitch.refreshing'), { duration: 1200 })
    await new Promise(resolve => setTimeout(resolve, 1000))
    location.reload()
  } catch (error) {
    toastError(error)
  } finally {
    switching = false
  }
}
