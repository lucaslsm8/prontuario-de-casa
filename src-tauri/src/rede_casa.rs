//! Rede de casa: com a rede atual cadastrada, o app abre sem senha nem biometria.
//! Identidade da rede: MAC do gateway padrão (Windows) ou BSSID do Wi-Fi (Android, RedePlugin.kt).
//! Guardamos só o SHA-256 do identificador normalizado, nunca o MAC/BSSID cru. Lista no kv `redes_casa`.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const CHAVE_KV: &str = "redes_casa";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Rede {
    pub id: String,
    pub nome: String,
}

/// "A4-2B-B0-12-34-56" ou "a4:2b:b0:12:34:56" → "a4:2b:b0:12:34:56".
/// None se não for um MAC, ou se for um dos valores que não identificam nada
/// (zerado, broadcast, ou o 02:00:00:00:00:00 que o Android devolve sem permissão).
pub fn normalizar_mac(s: &str) -> Option<String> {
    let partes: Vec<&str> = s.trim().split(['-', ':']).collect();
    if partes.len() != 6 || !partes.iter().all(|p| p.len() == 2 && p.bytes().all(|b| b.is_ascii_hexdigit())) {
        return None;
    }
    let mac = partes.join(":").to_ascii_lowercase();
    match mac.as_str() {
        "00:00:00:00:00:00" | "ff:ff:ff:ff:ff:ff" | "02:00:00:00:00:00" => None,
        _ => Some(mac),
    }
}

/// id guardado: SHA-256, em hex, do MAC/BSSID já normalizado.
pub fn id_da_rede(mac_normalizado: &str) -> String {
    Sha256::digest(mac_normalizado.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

pub fn id_valido(id: &str) -> bool {
    id.len() == 64 && id.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

#[cfg_attr(target_os = "android", allow(dead_code))]
fn eh_ipv4(s: &str) -> bool {
    s.parse::<std::net::Ipv4Addr>().is_ok()
}

// No Android a rede vem do Wi-Fi (rede_android.rs); as funções do desktop ficam sem uso lá.

/// Gateway padrão na saída de `route print -4 0.0.0.0` (qualquer idioma): linhas
/// "0.0.0.0  0.0.0.0  <gateway>  <interface>  <métrica>". Com mais de uma, fica a de menor métrica.
/// Só olha números: "On-link" / "No vínculo" não é IP e fica de fora.
#[cfg_attr(target_os = "android", allow(dead_code))]
pub fn gateway_da_rota(saida: &str) -> Option<String> {
    saida
        .lines()
        .filter_map(|l| {
            let t: Vec<&str> = l.split_whitespace().collect();
            if t.len() >= 3 && t[0] == "0.0.0.0" && t[1] == "0.0.0.0" && eh_ipv4(t[2]) && t[2] != "0.0.0.0" {
                let metrica = t.get(4).and_then(|m| m.parse::<u32>().ok()).unwrap_or(u32::MAX);
                Some((metrica, t[2].to_string()))
            } else {
                None
            }
        })
        .min_by_key(|(m, _)| *m)
        .map(|(_, ip)| ip)
}

/// MAC do IP na saída de `arp -a <ip>` (qualquer idioma): linha "<ip>  <mac>  <tipo>".
#[cfg_attr(target_os = "android", allow(dead_code))]
pub fn mac_do_arp(saida: &str, ip: &str) -> Option<String> {
    saida.lines().find_map(|l| {
        let mut t = l.split_whitespace();
        (t.next() == Some(ip)).then(|| t.next().and_then(normalizar_mac)).flatten()
    })
}

/// Rede a partir do MAC do gateway (desktop). Nome: "Rede (gateway a4:2b…)".
#[cfg_attr(target_os = "android", allow(dead_code))]
pub fn rede_do_gateway(mac: &str) -> Option<Rede> {
    let mac = normalizar_mac(mac)?;
    Some(Rede { id: id_da_rede(&mac), nome: format!("Rede (gateway {}…)", &mac[..5]) })
}

/// Rede a partir do Wi-Fi (Android). O SSID vem entre aspas, ou "<unknown ssid>" sem permissão.
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub fn rede_do_wifi(bssid: &str, ssid: Option<&str>) -> Option<Rede> {
    let mac = normalizar_mac(bssid)?;
    let nome = ssid.map(|s| s.trim().trim_matches('"').trim()).filter(|s| !s.is_empty() && *s != "<unknown ssid>").unwrap_or("Wi-Fi");
    Some(Rede { id: id_da_rede(&mac), nome: nome.to_string() })
}

/// Lista com a rede nova no fim (sem repetir o id).
pub fn adicionar(mut lista: Vec<Rede>, rede: Rede) -> Vec<Rede> {
    if !lista.iter().any(|r| r.id == rede.id) {
        lista.push(rede);
    }
    lista
}

pub fn remover(lista: Vec<Rede>, id: &str) -> Vec<Rede> {
    lista.into_iter().filter(|r| r.id != id).collect()
}

/// Windows: gateway por `route print`, MAC por `arp -a`, sem abrir janela de console.
#[cfg(windows)]
pub fn rede_atual_desktop() -> Option<Rede> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let rodar = |prog: &str, args: &[&str]| -> Option<String> {
        let out = std::process::Command::new(prog).args(args).creation_flags(CREATE_NO_WINDOW).output().ok()?;
        out.status.success().then(|| String::from_utf8_lossy(&out.stdout).into_owned())
    };
    let ip = gateway_da_rota(&rodar("route", &["print", "-4", "0.0.0.0"])?)?;
    let mac = mac_do_arp(&rodar("arp", &["-a", &ip])?, &ip)?;
    rede_do_gateway(&mac)
}

/// Linux/macOS: indisponível.
#[cfg(not(windows))]
#[cfg_attr(target_os = "android", allow(dead_code))]
pub fn rede_atual_desktop() -> Option<Rede> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const ROTA_PT: &str = "\
===========================================================================
Lista de interfaces
 12...a4 2b b0 12 34 56 ......Intel(R) Wi-Fi 6 AX201 160MHz
  1...........................Software Loopback Interface 1
===========================================================================

IPv4 Tabela de rota
===========================================================================
Rotas ativas:
Destino de rede       Máscara           Ender. gateway    Interface       Métrica
          0.0.0.0          0.0.0.0      192.168.0.1    192.168.0.10     35
          0.0.0.0          0.0.0.0         10.0.0.1       10.0.0.20     25
        127.0.0.0        255.0.0.0         No vínculo         127.0.0.1    331
===========================================================================
Rotas persistentes:
  Nenhum
";

    const ROTA_EN: &str = "\
IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0     192.168.1.254    192.168.1.33     50
===========================================================================
Persistent Routes:
  None
";

    const ROTA_SEM_GATEWAY: &str = "\
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331
";

    const ARP_PT: &str = "\
Interface: 192.168.0.10 --- 0xc
  Endereço IP           Endereço físico       Tipo
  192.168.0.1           a4-2b-b0-12-34-56     dinâmico
";

    const ARP_EN: &str = "\
Interface: 192.168.1.33 --- 0x7
  Internet Address      Physical Address      Type
  192.168.1.254         F0-9F-C2-AB-CD-EF     dynamic
  192.168.1.255         ff-ff-ff-ff-ff-ff     static
";

    #[test]
    fn gateway_em_portugues_fica_o_de_menor_metrica() {
        assert_eq!(gateway_da_rota(ROTA_PT).as_deref(), Some("10.0.0.1"));
    }

    #[test]
    fn gateway_em_ingles() {
        assert_eq!(gateway_da_rota(ROTA_EN).as_deref(), Some("192.168.1.254"));
    }

    #[test]
    fn sem_gateway_e_sem_texto() {
        assert_eq!(gateway_da_rota(ROTA_SEM_GATEWAY), None);
        assert_eq!(gateway_da_rota(""), None);
    }

    #[test]
    fn mac_do_arp_em_portugues_e_ingles() {
        assert_eq!(mac_do_arp(ARP_PT, "192.168.0.1").as_deref(), Some("a4:2b:b0:12:34:56"));
        assert_eq!(mac_do_arp(ARP_EN, "192.168.1.254").as_deref(), Some("f0:9f:c2:ab:cd:ef"));
        // Broadcast não identifica a rede; IP ausente não devolve nada.
        assert_eq!(mac_do_arp(ARP_EN, "192.168.1.255"), None);
        assert_eq!(mac_do_arp(ARP_PT, "192.168.0.99"), None);
        // "192.168.0.1" não casa com o começo de "192.168.0.10" (linha Interface).
        assert_eq!(mac_do_arp("Interface: 192.168.0.10 --- 0xc\n", "192.168.0.1"), None);
    }

    #[test]
    fn normaliza_mac_e_recusa_os_vazios() {
        assert_eq!(normalizar_mac("A4-2B-B0-12-34-56").as_deref(), Some("a4:2b:b0:12:34:56"));
        assert_eq!(normalizar_mac(" a4:2b:b0:12:34:56 ").as_deref(), Some("a4:2b:b0:12:34:56"));
        assert_eq!(normalizar_mac("02:00:00:00:00:00"), None);
        assert_eq!(normalizar_mac("00-00-00-00-00-00"), None);
        assert_eq!(normalizar_mac("a4:2b:b0:12:34"), None);
        assert_eq!(normalizar_mac("dinâmico"), None);
        assert_eq!(normalizar_mac("g4:2b:b0:12:34:56"), None);
    }

    #[test]
    fn mesmo_id_em_qualquer_formato_e_sem_o_mac_cru() {
        let a = rede_do_gateway("A4-2B-B0-12-34-56").unwrap();
        let b = rede_do_wifi("a4:2b:b0:12:34:56", Some("\"Casa\"")).unwrap();
        assert_eq!(a.id, b.id);
        assert!(id_valido(&a.id));
        assert!(!a.id.contains("a42bb0"));
        // SHA-256("a4:2b:b0:12:34:56"), conferido fora do app.
        assert_eq!(a.id, id_da_rede("a4:2b:b0:12:34:56"));
        assert_eq!(id_da_rede("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_eq!(a.nome, "Rede (gateway a4:2b…)");
    }

    #[test]
    fn nome_do_wifi() {
        assert_eq!(rede_do_wifi("a4:2b:b0:12:34:56", Some("\"Casa Almeida\"")).unwrap().nome, "Casa Almeida");
        assert_eq!(rede_do_wifi("a4:2b:b0:12:34:56", Some("<unknown ssid>")).unwrap().nome, "Wi-Fi");
        assert_eq!(rede_do_wifi("a4:2b:b0:12:34:56", None).unwrap().nome, "Wi-Fi");
        assert_eq!(rede_do_wifi("02:00:00:00:00:00", Some("\"Casa\"")), None);
    }

    /// Manual (`cargo test -- --ignored`): lê a rede deste computador sem mostrar o MAC.
    #[test]
    #[ignore]
    #[cfg(windows)]
    fn le_a_rede_deste_computador() {
        let r = rede_atual_desktop().expect("sem gateway/MAC");
        assert!(id_valido(&r.id));
    }

    #[test]
    fn adicionar_sem_repetir_e_remover() {
        let r1 = Rede { id: id_da_rede("a"), nome: "Casa".into() };
        let r2 = Rede { id: id_da_rede("b"), nome: "Sítio".into() };
        let l = adicionar(adicionar(adicionar(vec![], r1.clone()), r2.clone()), r1.clone());
        assert_eq!(l, vec![r1.clone(), r2.clone()]);
        assert_eq!(remover(l, &r1.id), vec![r2]);
    }
}
