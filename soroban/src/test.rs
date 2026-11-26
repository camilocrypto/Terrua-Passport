use super::*;
use soroban_sdk::{testutils::Address as _, vec};

#[test]
fn bottle_lifecycle_and_authorization() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let reviewer = Address::generate(&env);
    let winery = Address::generate(&env);
    let holder = Address::generate(&env);
    let id = env.register(Passport, (&admin, &reviewer));
    let client = PassportClient::new(&env, &id);
    let winery_id = BytesN::from_array(&env, &[1; 32]);
    let digest = BytesN::from_array(&env, &[2; 32]);
    assert!(client.try_set_winery(&winery_id, &winery).is_err());
    env.mock_all_auths();
    client.set_winery(&winery_id, &winery);
    let lot = client.register_lot(&winery_id, &digest, &digest, &1, &3);
    assert_eq!(
        client.try_register_lot(&winery_id, &digest, &digest, &1, &3),
        Err(Ok(Error::Duplicate))
    );
    let codes = [
        *b"0123456789ABCDEF",
        *b"ABCDEFGHJKMNPQRS",
        *b"1111111111111111",
    ]
    .map(|code| BytesN::from_array(&env, &code));
    let hashes = env.as_contract(&id, || {
        vec![
            &env,
            commitment(&env, &lot, 1, &codes[0]).unwrap(),
            commitment(&env, &lot, 2, &codes[1]).unwrap(),
            commitment(&env, &lot, 3, &codes[2]).unwrap(),
        ]
    });
    assert_eq!(
        client.try_register_bottles(&lot, &2, &hashes),
        Err(Ok(Error::InvalidRange))
    );
    client.register_bottles(&lot, &1, &hashes);
    assert_eq!(
        client.try_register_bottles(&lot, &1, &hashes),
        Err(Ok(Error::Duplicate))
    );
    assert_eq!(
        client.try_consume_bottle(&lot, &1, &codes[0]),
        Err(Ok(Error::Unassigned))
    );
    client.assign_bottle(&lot, &1, &holder);
    assert_eq!(
        client.try_assign_bottle(&lot, &1, &winery),
        Err(Ok(Error::AlreadyAssigned))
    );
    assert_eq!(
        client.try_consume_bottle(&lot, &1, &codes[1]),
        Err(Ok(Error::InvalidCode))
    );
    env.mock_auths(&[]);
    assert!(client.try_consume_bottle(&lot, &1, &codes[0]).is_err());
    assert!(client.try_withdraw_bottle(&lot, &2, &digest).is_err());
    env.mock_all_auths();
    client.consume_bottle(&lot, &1, &codes[0]);
    assert_eq!(env.auths()[0].0, holder);
    client.withdraw_bottle(&lot, &2, &digest);
    assert_eq!(env.auths()[0].0, reviewer);
    assert_eq!(
        client.try_consume_bottle(&lot, &1, &codes[0]),
        Err(Ok(Error::Inactive))
    );
    assert_eq!(
        client.try_consume_bottle(&lot, &2, &codes[1]),
        Err(Ok(Error::Inactive))
    );
    assert_eq!(client.get_bottle(&lot, &1).state, State::Consumed);
    assert_eq!(client.get_bottle(&lot, &2).state, State::Withdrawn);
    assert_eq!(client.get_bottle(&lot, &3).state, State::Active);
    assert_eq!(client.get_lot(&lot).registered, 3);
    assert_eq!(client.get_lot(&lot).active, 1);
}
