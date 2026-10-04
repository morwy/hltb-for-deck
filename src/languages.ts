import bg from './localizations/bg.json';
import cs from './localizations/cs.json';
import da from './localizations/da.json';
import de from './localizations/de.json';
import el from './localizations/el.json';
import en from './localizations/en.json';
import es from './localizations/es.json';
import es419 from './localizations/es-419.json';
import fi from './localizations/fi.json';
import fr from './localizations/fr.json';
import hu from './localizations/hu.json';
import it from './localizations/it.json';
import ja from './localizations/ja.json';
import ko from './localizations/ko.json';
import nl from './localizations/nl.json';
import no from './localizations/no.json';
import pl from './localizations/pl.json';
import pt from './localizations/pt.json';
import ptBr from './localizations/pt-br.json';
import ro from './localizations/ro.json';
import ru from './localizations/ru.json';
import sv from './localizations/sv.json';
import th from './localizations/th.json';
import tr from './localizations/tr.json';
import uk from './localizations/uk.json';
import vi from './localizations/vi.json';
import zhCn from './localizations/zh-cn.json';
import zhTw from './localizations/zh-tw.json';

type Catalog = Partial<Record<keyof typeof en, string>>;

const catalogs = {
    bg,
    cs,
    da,
    de,
    el,
    en,
    es,
    es419,
    fi,
    fr,
    hu,
    it,
    ja,
    ko,
    nl,
    no,
    pl,
    pt,
    ptBr,
    ro,
    ru,
    sv,
    th,
    tr,
    uk,
    vi,
    zhCn,
    zhTw,
} as const;

// English defines all keys; missing translations fall back to English.
const languages = catalogs as Record<keyof typeof catalogs, Catalog> & {
    en: typeof en;
};

export default languages;
