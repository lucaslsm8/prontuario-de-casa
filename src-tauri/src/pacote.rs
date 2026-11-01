//! Pacotes de sincronização: eventos em JSON, cifrados com a chave da família.
//! AAD = "<familiaId>|<aparelhoId>|<n>": um pacote não pode ser trocado de lugar nem de aparelho.

use crate::cripto::Cofre;
use serde_json::Value;

type R<T> = Result<T, String>;

const MAX_EVENTOS: usize = 200;
const MAX_BYTES: usize = 1024 * 1024;

pub fn nome(aparelho: &str, n: u32) -> String {
    format!("eventos/{aparelho}/{n:06}.bin")
}

fn aad(familia: &str, aparelho: &str, n: u32) -> Vec<u8> {
    format!("{familia}|{aparelho}|{n}").into_bytes()
}

/// Quantos eventos do começo cabem no próximo pacote: até 200 ou ~1 MB de JSON; um evento maior que isso vai sozinho.
pub fn primeira_fatia(eventos: &[Value]) -> usize {
    let mut bytes = 0usize;
    for (i, ev) in eventos.iter().enumerate() {
        let tam = serde_json::to_vec(ev).map(|v| v.len()).unwrap_or(0);
        if i > 0 && (i >= MAX_EVENTOS || bytes + tam > MAX_BYTES) {
            return i;
        }
        bytes += tam;
    }
    eventos.len()
}

/// Divide em pacotes de até 200 eventos ou ~1 MB de JSON; um evento maior que isso vai sozinho.
#[cfg(test)]
pub fn fatiar(mut eventos: &[Value]) -> Vec<Vec<Value>> {
    let mut out = Vec::new();
    while !eventos.is_empty() {
        let k = primeira_fatia(eventos);
        out.push(eventos[..k].to_vec());
        eventos = &eventos[k..];
    }
    out
}

pub fn empacotar(chave: &[u8; 32], familia: &str, aparelho: &str, n: u32, eventos: &[Value]) -> R<Vec<u8>> {
    let claro = serde_json::to_vec(&serde_json::json!({ "eventos": eventos })).map_err(|e| e.to_string())?;
    Cofre::new(chave).cifrar(&claro, &aad(familia, aparelho, n)).map_err(|e| e.to_string())
}

pub fn desempacotar(chave: &[u8; 32], familia: &str, aparelho: &str, n: u32, bytes: &[u8]) -> R<Vec<Value>> {
    let claro = Cofre::new(chave).decifrar(bytes, &aad(familia, aparelho, n)).map_err(|_| format!("pacote {} não decifra", nome(aparelho, n)))?;
    let v: Value = serde_json::from_slice(&claro).map_err(|e| e.to_string())?;
    Ok(v.get("eventos").and_then(Value::as_array).cloned().unwrap_or_default())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::cripto::aleatorio;
    use serde_json::json;

    #[test]
    fn ida_e_volta_e_nada_em_claro() {
        let k = aleatorio::<32>();
        let evs = vec![json!({"id": "a", "dados": {"nome": "Roberto Carlos Almeida"}})];
        let b = empacotar(&k, "f1", "pc-aaaaaa", 1, &evs).unwrap();
        assert!(!b.windows(7).any(|w| w == b"Roberto"));
        assert_eq!(desempacotar(&k, "f1", "pc-aaaaaa", 1, &b).unwrap(), evs);
    }

    #[test]
    fn chave_ou_lugar_errado_nao_abre() {
        let k = aleatorio::<32>();
        let b = empacotar(&k, "f1", "pc-aaaaaa", 1, &[json!({"id": "a"})]).unwrap();
        assert!(desempacotar(&aleatorio::<32>(), "f1", "pc-aaaaaa", 1, &b).is_err());
        assert!(desempacotar(&k, "f1", "pc-aaaaaa", 2, &b).is_err());
        assert!(desempacotar(&k, "f1", "cel-bbbbbb", 1, &b).is_err());
        assert!(desempacotar(&k, "f2", "pc-aaaaaa", 1, &b).is_err());
    }

    #[test]
    fn fatia_por_quantidade_e_tamanho() {
        let muitos: Vec<Value> = (0..450).map(|i| json!({"id": i.to_string()})).collect();
        assert_eq!(fatiar(&muitos).iter().map(Vec::len).collect::<Vec<_>>(), [200, 200, 50]);
        let grande = json!({"id": "g", "dados": "x".repeat(1_200_000)});
        let f = fatiar(&[json!({"id": "a"}), grande, json!({"id": "b"})]);
        assert_eq!(f.iter().map(Vec::len).collect::<Vec<_>>(), [1, 1, 1]);
        assert!(fatiar(&[]).is_empty());
    }

    #[test]
    fn nome_com_seis_digitos() {
        assert_eq!(nome("pc-aaaaaa", 7), "eventos/pc-aaaaaa/000007.bin");
    }
}
