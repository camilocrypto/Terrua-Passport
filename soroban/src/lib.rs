#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, xdr::ToXdr, Address, Bytes,
    BytesN, Env, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum State {
    Active,
    Withdrawn,
    Consumed,
}

#[contracttype]
#[derive(Clone)]
pub struct Lot {
    pub winery: BytesN<32>,
    pub manifest: BytesN<32>,
    pub first: u32,
    pub count: u32,
    pub registered: u32,
    pub active: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Bottle {
    pub commitment: BytesN<32>,
    pub holder: Option<Address>,
    pub state: State,
    pub changed_ledger: u32,
    pub reason: Option<BytesN<32>>,
}

#[contracttype]
enum Key {
    Admin,
    Reviewer,
    Winery(BytesN<32>),
    Lot(BytesN<32>),
    Bottle(BytesN<32>, u32),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    Missing = 1,
    Duplicate = 2,
    InvalidRange = 3,
    AlreadyAssigned = 4,
    Inactive = 5,
    InvalidCode = 6,
    Unassigned = 7,
}

#[contract]
pub struct Passport;

#[contractimpl]
impl Passport {
    pub fn __constructor(env: Env, admin: Address, reviewer: Address) {
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::Reviewer, &reviewer);
    }

    pub fn set_winery(env: Env, winery: BytesN<32>, signer: Address) {
        role(&env, Key::Admin).require_auth();
        save(&env, &Key::Winery(winery.clone()), &signer);
        event(&env, symbol_short!("winery"), &winery, 0);
    }

    pub fn set_reviewer(env: Env, reviewer: Address) {
        role(&env, Key::Admin).require_auth();
        env.storage().instance().set(&Key::Reviewer, &reviewer);
    }

    pub fn register_lot(
        env: Env,
        winery: BytesN<32>,
        code_hash: BytesN<32>,
        manifest: BytesN<32>,
        first: u32,
        count: u32,
    ) -> Result<BytesN<32>, Error> {
        winery_auth(&env, &winery)?;
        if first == 0 || count == 0 || count > 4800 || first > 100_000_000 - count {
            return Err(Error::InvalidRange);
        }
        let mut identity = Bytes::from_slice(&env, b"terrua.lot.v1");
        identity.append(&winery.clone().into());
        identity.append(&code_hash.into());
        let id: BytesN<32> = env.crypto().sha256(&identity).into();
        let key = Key::Lot(id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::Duplicate);
        }
        save(
            &env,
            &key,
            &Lot {
                winery,
                manifest,
                first,
                count,
                registered: 0,
                active: 0,
            },
        );
        event(&env, symbol_short!("lot"), &id, 0);
        Ok(id)
    }

    pub fn register_bottles(
        env: Env,
        lot: BytesN<32>,
        first: u32,
        commitments: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        let mut entry = Self::get_lot(env.clone(), lot.clone())?;
        winery_auth(&env, &entry.winery)?;
        let count = commitments.len();
        if count == 0
            || count > 8
            || first < entry.first
            || first >= entry.first + entry.count
            || count > entry.first + entry.count - first
        {
            return Err(Error::InvalidRange);
        }
        for (offset, commitment) in commitments.iter().enumerate() {
            let number = first + offset as u32;
            let key = Key::Bottle(lot.clone(), number);
            if env.storage().persistent().has(&key) {
                return Err(Error::Duplicate);
            }
            save(
                &env,
                &key,
                &Bottle {
                    commitment,
                    holder: None,
                    state: State::Active,
                    changed_ledger: env.ledger().sequence(),
                    reason: None,
                },
            );
            event(&env, symbol_short!("bottle"), &lot, number);
        }
        entry.registered += count;
        entry.active += count;
        save(&env, &Key::Lot(lot), &entry);
        Ok(())
    }

    pub fn assign_bottle(
        env: Env,
        lot: BytesN<32>,
        number: u32,
        holder: Address,
    ) -> Result<(), Error> {
        let entry = Self::get_lot(env.clone(), lot.clone())?;
        winery_auth(&env, &entry.winery)?;
        let mut bottle = active_bottle(&env, &lot, number)?;
        if bottle.holder.is_some() {
            return Err(Error::AlreadyAssigned);
        }
        bottle.holder = Some(holder);
        bottle.changed_ledger = env.ledger().sequence();
        save(&env, &Key::Bottle(lot.clone(), number), &bottle);
        event(&env, symbol_short!("assign"), &lot, number);
        Ok(())
    }

    pub fn withdraw_bottle(
        env: Env,
        lot: BytesN<32>,
        number: u32,
        reason: BytesN<32>,
    ) -> Result<(), Error> {
        role(&env, Key::Reviewer).require_auth();
        let mut bottle = active_bottle(&env, &lot, number)?;
        bottle.state = State::Withdrawn;
        bottle.reason = Some(reason);
        finish_bottle(&env, &lot, number, bottle)?;
        event(&env, symbol_short!("withdraw"), &lot, number);
        Ok(())
    }

    pub fn consume_bottle(
        env: Env,
        lot: BytesN<32>,
        number: u32,
        code: BytesN<16>,
    ) -> Result<(), Error> {
        let mut bottle = active_bottle(&env, &lot, number)?;
        bottle
            .holder
            .as_ref()
            .ok_or(Error::Unassigned)?
            .require_auth();
        if commitment(&env, &lot, number, &code)? != bottle.commitment {
            return Err(Error::InvalidCode);
        }
        bottle.state = State::Consumed;
        finish_bottle(&env, &lot, number, bottle)?;
        event(&env, symbol_short!("consume"), &lot, number);
        Ok(())
    }

    pub fn get_lot(env: Env, lot: BytesN<32>) -> Result<Lot, Error> {
        env.storage()
            .persistent()
            .get(&Key::Lot(lot))
            .ok_or(Error::Missing)
    }

    pub fn get_bottle(env: Env, lot: BytesN<32>, number: u32) -> Result<Bottle, Error> {
        env.storage()
            .persistent()
            .get(&Key::Bottle(lot, number))
            .ok_or(Error::Missing)
    }
}

fn role(env: &Env, key: Key) -> Address {
    env.storage().instance().get(&key).unwrap()
}

fn winery_auth(env: &Env, winery: &BytesN<32>) -> Result<(), Error> {
    let signer: Address = env
        .storage()
        .persistent()
        .get(&Key::Winery(winery.clone()))
        .ok_or(Error::Missing)?;
    signer.require_auth();
    Ok(())
}

fn save<V>(env: &Env, key: &Key, value: &V)
where
    V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    let storage = env.storage().persistent();
    storage.set(key, value);
    let ttl = env.storage().max_ttl().min(120_960);
    storage.extend_ttl(key, ttl / 2, ttl);
}

fn active_bottle(env: &Env, lot: &BytesN<32>, number: u32) -> Result<Bottle, Error> {
    let bottle = Passport::get_bottle(env.clone(), lot.clone(), number)?;
    if bottle.state != State::Active {
        return Err(Error::Inactive);
    }
    Ok(bottle)
}

fn finish_bottle(
    env: &Env,
    lot: &BytesN<32>,
    number: u32,
    mut bottle: Bottle,
) -> Result<(), Error> {
    let mut entry = Passport::get_lot(env.clone(), lot.clone())?;
    entry.active -= 1;
    bottle.changed_ledger = env.ledger().sequence();
    save(env, &Key::Lot(lot.clone()), &entry);
    save(env, &Key::Bottle(lot.clone(), number), &bottle);
    Ok(())
}

fn commitment(
    env: &Env,
    lot: &BytesN<32>,
    number: u32,
    code: &BytesN<16>,
) -> Result<BytesN<32>, Error> {
    if !code
        .to_array()
        .iter()
        .all(|c| b"0123456789ABCDEFGHJKMNPQRSTVWXYZ".contains(c))
    {
        return Err(Error::InvalidCode);
    }
    let mut input = Bytes::from_slice(env, b"terrua.cork.v1");
    input.append(&env.ledger().network_id().into());
    input.append(&env.current_contract_address().to_xdr(env));
    input.append(&lot.clone().into());
    input.extend_from_array(&number.to_be_bytes());
    input.append(&code.clone().into());
    Ok(env.crypto().sha256(&input).into())
}

#[allow(deprecated)]
fn event(env: &Env, action: Symbol, lot: &BytesN<32>, number: u32) {
    env.events().publish((action, lot.clone(), number), ());
}

#[cfg(test)]
mod test;
