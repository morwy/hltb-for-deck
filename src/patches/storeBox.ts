// These functions don't run in the plugin. StorePatch sends their source to the
// Steam store page with Runtime.evaluate, so each one must be self-contained:
// no imports, no outside variables, no helpers. Data only comes in as JSON and
// is only written with textContent.

export interface StoreBoxRow {
    value: string;
    label: string;
}

export interface StoreBoxPayload {
    id: string;
    detailsBinding: string;
    css: string;
    vars: Record<string, string>;
    rows: StoreBoxRow[];
    viewDetails: { label: string; gameId: number } | null;
}

export function showStoreBox(payload: StoreBoxPayload) {
    var existing = document.getElementById(payload.id);
    if (existing) {
        existing.remove();
    }
    if (!document.body) {
        // Called mid-load. The load event updates the store box again.
        return;
    }

    var host = document.createElement('div');
    host.id = payload.id;
    // Inline !important so the store's own stylesheets can't move the box.
    var positioning: Record<string, string> = {
        position: 'fixed',
        left: '16px',
        bottom: '20px',
        'z-index': '999998',
        'max-width': 'calc(100vw - 32px)',
        margin: '0',
        padding: '0',
        display: 'block',
    };
    for (var property in positioning) {
        host.style.setProperty(property, positioning[property], 'important');
    }
    for (var name in payload.vars) {
        host.style.setProperty(name, payload.vars[name]);
    }

    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = payload.css;
    root.appendChild(style);

    var wrapper = document.createElement('div');
    wrapper.className = 'hltb-store';
    var info = document.createElement('div');
    info.className = 'hltb-info';
    var list = document.createElement('ul');
    list.style.display = 'flex';
    list.style.justifyContent = 'space-evenly';

    for (var i = 0; i < payload.rows.length; i++) {
        var item = document.createElement('li');
        var value = document.createElement('p');
        value.className = 'hltb-gametime';
        value.textContent = payload.rows[i].value;
        var label = document.createElement('p');
        label.className = 'hltb-label';
        label.textContent = payload.rows[i].label;
        item.appendChild(value);
        item.appendChild(label);
        list.appendChild(item);
    }

    var details = payload.viewDetails;
    var openHltbGamePage = (window as any)[payload.detailsBinding];
    // Without the binding the button couldn't do anything, so leave it out.
    // It goes last in the stats row, like in the library.
    if (details && typeof openHltbGamePage === 'function') {
        var gameId = String(details.gameId);
        var buttonItem = document.createElement('li');
        buttonItem.className = 'hltb-details-item';
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'hltb-details-btn';
        button.textContent = details.label;
        button.addEventListener('click', function () {
            openHltbGamePage(gameId);
        });
        buttonItem.appendChild(button);
        list.appendChild(buttonItem);
    }

    info.appendChild(list);
    wrapper.appendChild(info);
    root.appendChild(wrapper);
    document.body.appendChild(host);
}

export function removeStoreBox(id: string) {
    var existing = document.getElementById(id);
    if (existing) {
        existing.remove();
    }
}
