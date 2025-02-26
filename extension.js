const { St, Clutter, GLib, Gio, GObject } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;

const PortManagerExtension = GObject.registerClass(
    class PortManagerExtension extends PanelMenu.Button {
        _init() {
            super._init(0.0, "Port Manager", false);
            let icon = new St.Icon({
                icon_name: 'network-server-symbolic',
                style_class: 'system-status-icon'
            });
            this.add_child(icon);

            let screenHeight = global.display.get_monitor_geometry(0).height;
            let maxMenuHeight = screenHeight / 2;
            
            this.scrollView = new St.ScrollView({
                style_class: 'port-manager-scrollview',
                overlay_scrollbars: true
            });
            this.menu.box.add(this.scrollView);

            this.menuItemsBox = new St.BoxLayout({ vertical: true });
            this.scrollView.add_actor(this.menuItemsBox);
            
            this.scrollView.connect('style-changed', () => {
                let currentHeight = this.menuItemsBox.height;
                this.scrollView.set_height(Math.min(currentHeight, maxMenuHeight));
            });
            
            this.refreshPorts();
            this.connect('button-press-event', () => this.refreshPorts());
        }

        refreshPorts() {
            this.menuItemsBox.destroy_all_children();
            let ports = this.getOpenPorts();

            if (ports.length === 0) {
                let noPortsItem = new PopupMenu.PopupMenuItem("Listening ports not found", { reactive: false });
                this.menuItemsBox.add_child(noPortsItem);
            } else {
                ports.forEach(port => {
                    let menuItem = new PopupMenu.PopupMenuItem(`Port ${port.port} (${port.process})`);
                    let closeButton = new St.Button({
                        style_class: 'port-close-button',
                        child: new St.Label({ text: 'X', y_align: Clutter.ActorAlign.CENTER })
                    });
                    closeButton.connect('button-press-event', () => this.closePort(port.pid));
                    menuItem.add_child(closeButton);
                    this.menuItemsBox.add_child(menuItem);
                });
            }
        }

        getOpenPorts() {
            try {
                let [ok, stdout] = GLib.spawn_command_line_sync("bash -c \"lsof -i -P -n | grep LISTEN\"");
                if (ok) {
                    let output = ByteArray.toString(stdout).trim();
                    let lines = output.split(/\r?\n/).filter(line => line.trim().length > 0);
                    let ports = lines.map(line => {
                        let parts = line.split(/\s+/);
                        let process = parts[0] || "Unknown";
                        let pid = parts[1] || null;
                        let portMatches = line.match(/:(\d+)(?=\s|\()/g);
                        let port = portMatches ? portMatches.pop().replace(":", "") : null;
                        return port && pid ? { port, process, pid } : null;
                    }).filter(p => p);
                    return ports;
                }
            } catch (e) {
                log("Failed to retrieve port list: " + e);
            }
            return [];
        }

        closePort(pid) {
            try {
                Util.spawnCommandLine(`kill -9 ${pid}`);
                this.refreshPorts();
            } catch (e) {
                log("Failed to close port: " + e);
            }
        }
    }
);

let indicator;
function init() {}
function enable() {
    indicator = new PortManagerExtension();
    Main.panel.addToStatusArea('port-manager', indicator);
}
function disable() {
    if (indicator) {
        indicator.destroy();
        indicator = null;
    }
}
